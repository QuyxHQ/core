import express, { Request, Response } from "express";
import { cronSenderIsValid, isFromMoralis } from "../../shared/utils/validators";
import { decodeLog } from "./service";
import { ethers } from "ethers";
import { addBid, findBid } from "../bid/service";
import { countCards, deleteCard, findCard, findCards, updateCard } from "../card/service";
import {
  sendBidPlacedMail,
  sendCardBoughtMail,
  sendCardTransferredToMail,
  sendHighestBidPlacedMail,
} from "../../shared/utils/mailer";
import { findUser } from "../user/service";
import { updateManyReferral } from "../referral/service";
import { endAuctionOnChain } from "../../shared/utils/helpers";
import { updateManySDKUsers } from "../sdk/service";

const router = express.Router();

//# cron job endpoint
router.post(
  "/cron/check-auction",
  cronSenderIsValid,
  async function (_: Request, res: Response) {
    try {
      const countOfOpenAuctionThatAreExpired = await countCards({
        isForSale: true,
        isDeleted: false,
        auctionEnds: {
          $lte: new Date(),
        },
      });

      const endedButActiveAuctions = await findCards(
        {
          isForSale: true,
          isDeleted: false,
          auctionEnds: {
            $lte: new Date(),
          },
        },
        { limit: countOfOpenAuctionThatAreExpired, page: 1 }
      );

      if (endedButActiveAuctions.length > 0) {
        //# loop and end them.....
        for (let auctions of endedButActiveAuctions) {
          //# helper fn to end it on chain
          await endAuctionOnChain(auctions.chainId, auctions.identifier!);
        }
      }

      return res.sendStatus(200);
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# moralis webhook route
router.post(
  "/moralis",
  isFromMoralis,
  async function (req: Request<{}, {}, MoralisStreamResponse>, res: Response) {
    try {
      if (req.body.confirmed) return res.sendStatus(200);

      const decodedLogs = decodeLog(req.body);
      const chainId = String(parseInt(req.body.chainId, 16)) as (typeof QUYX_NETWORKS)[number];

      for (let decodedLog of decodedLogs) {
        if (decodedLog.name == "BidPlaced") {
          const bidder = decodedLog.args.from;
          const cardId = parseInt(decodedLog.args.cardId.toString() as string);
          // const referredBy = decodedLog.args.referredBy; - send a mail to referall later in future
          const amount = parseInt(ethers.utils.formatEther(decodedLog.args.amount));
          const timestamp = new Date(decodedLog.args.timestamp);

          const card = await findCard({
            identifier: cardId,
            isForSale: true,
            isDeleted: false,
            isAuction: true,
          });

          if (card) {
            const currentHighestBid = await findBid({
              card: card._id,
              version: card.version!,
            });

            //# add bid in record
            await addBid({
              bidder,
              price: amount,
              timestamp,
              card: card._id,
              version: card.version!,
            });

            //# send bid placed mail to owner of card
            const owner = await findUser({ _id: card.owner });
            if (owner && owner.email) {
              await sendBidPlacedMail({
                amount,
                cardId,
                chainId,
                username: owner.username,
                email: owner.email,
              });
            }

            if (currentHighestBid) {
              //# send highest bid placed mail (former highest bidder)
              const formerHighestBidder = await findUser({
                address: currentHighestBid.bidder,
              });
              if (formerHighestBidder && formerHighestBidder.email) {
                await sendHighestBidPlacedMail({
                  cardId,
                  email: formerHighestBidder.email,
                  username: formerHighestBidder.username,
                });
              }
            }
          }
        }

        if (decodedLog.name == "CardListedForSale") {
          const cardId = parseInt(decodedLog.args.cardId.toString() as string);
          const version = parseInt(decodedLog.args.version.toString() as string);
          const isAuction = decodedLog.args.isAuction as boolean;
          const listingPrice = parseInt(
            ethers.utils.formatEther(decodedLog.args.listingPrice)
          );
          const maxNumberOfBids = parseInt(
            decodedLog.args.maxNumberOfBids.toString() as string
          );
          const end = new Date(decodedLog.args.end);

          //# update the card to the latest value
          await updateCard(
            { identifier: cardId, chainId, isForSale: false, isDeleted: false },
            {
              version,
              isForSale: true,
              isAuction,
              listingPrice,
              maxNumberOfBids,
              auctionEnds: end,
            }
          );
        }

        if (decodedLog.name == "CardMinted") {
          const owner = decodedLog.args.owner;
          const cardId = parseInt(decodedLog.args.cardId.toString() as string);
          const tempToken = decodedLog.args.tempToken;

          const ownerDetails = await findUser({ address: owner });
          if (ownerDetails) {
            //# add the card ID --
            await updateCard(
              { tempToken, chainId, owner: ownerDetails._id },
              { identifier: cardId }
            );
          }
        }

        if (decodedLog.name == "CardDeleted") {
          const cardId = parseInt(decodedLog.args.cardId.toString() as string);
          const card = await findCard({ identifier: cardId, chainId, isDeleted: false });
          if (card) {
            await deleteCard({ _id: card._id, isDeleted: false });
            await updateManySDKUsers(
              {
                card: card._id,
                isActive: true,
              },
              { card: null }
            );
          }
        }

        if (decodedLog.name == "CardSold") {
          const to = decodedLog.args.to;
          const cardId = parseInt(decodedLog.args.cardId.toString() as string);

          const card = await findCard({
            identifier: cardId,
            chainId,
            isForSale: true,
            isDeleted: false,
            isAuction: true,
          });

          if (card) {
            const cardOwner = await findUser({ _id: card.owner });
            if (cardOwner && cardOwner.email) {
              await sendCardBoughtMail({
                chainId,
                cardId,
                email: cardOwner.email,
                username: cardOwner.username,
              });

              await updateManySDKUsers(
                { address: cardOwner.address, card: card._id, isActive: true },
                { card: null }
              );
            }

            const cardNewOwner = await findUser({ address: to });
            if (cardNewOwner && cardNewOwner.email) {
              await sendCardTransferredToMail({
                chainId,
                cardId,
                email: cardNewOwner.email,
                username: cardNewOwner.username,
              });
            }

            await updateCard(
              { _id: card._id },
              {
                owner: cardNewOwner?._id,
                isForSale: false,
                isAuction: null,
                maxNumberOfBids: null,
                listingPrice: null,
                auctionEnds: null,
              }
            );

            //# make all referral links incative
            await updateManyReferral({ card: card._id }, { isActive: false });
          }
        }

        if (decodedLog.name == "CardUnlisted") {
          const cardId = parseInt(decodedLog.args.cardId.toString() as string);

          const card = await findCard({
            identifier: cardId,
            isForSale: true,
            isDeleted: false,
            isAuction: true,
          });

          if (card) {
            await updateCard(
              { _id: card._id },
              {
                isForSale: false,
                isAuction: null,
                maxNumberOfBids: null,
                listingPrice: null,
                auctionEnds: null,
              }
            );

            //# make all referral links incative
            await updateManyReferral({ card: card._id }, { isActive: false });
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
  }
);

export = router;
