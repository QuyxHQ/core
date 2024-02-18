import express, { Request, Response } from "express";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import { countBids, findBids } from "./service";
import { findUser } from "../user/service";

const router = express.Router();

//# get all bids of a user
router.get(
  "/",
  canAccessRoute(QUYX_USER.USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { identifier } = res.locals.meta;
      const user = await findUser({ _id: identifier });

      const totalBids = await countBids({ bidder: user!.address });
      const bids = await findBids(
        { bidder: user!.address },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched bids",
        data: bids,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalBids,
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

export = router;
