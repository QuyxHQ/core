import express, { Request, Response } from "express";
import { isCronSenderValid } from "../../shared/utils/validators";
import { dateUTC } from "../../shared/utils/helpers";
import { sendAuctionEndedMail } from "../../shared/utils/mailer";
import { countCards, findCards } from "../card/service";
import { findUser } from "../user/service";

const router = express.Router();

router.post("/auction", isCronSenderValid, async function (req: Request, res: Response) {
  try {
    const filter = {
      isForSale: true,
      isDeleted: false,
      isAuction: true,
      auctionEnds: { $lte: dateUTC() },
    };

    const countOfOpenAuctionThatAreExpired = await countCards(filter);
    if (countOfOpenAuctionThatAreExpired > 0) {
      const endedButActiveAuctions = await findCards(filter, {
        limit: countOfOpenAuctionThatAreExpired,
        page: 1,
      });

      //# loop and send end mail to owners.....
      for (let auctions of endedButActiveAuctions) {
        const owner = await findUser({ _id: auctions.owner });
        if (owner && owner.hasCompletedKYC && owner.email) {
          await sendAuctionEndedMail({
            card: auctions.toJSON(),
            email: owner.email,
            username: owner.username,
          });
        }
      }
    }

    return res.sendStatus(200);
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

export = router;
