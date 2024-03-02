import express, { Request, Response } from "express";
import { cronSenderIsValid, isFromMoralis } from "../../shared/utils/validators";
import { decodeLog } from "./service";
import { ethers } from "ethers";
import { addBid, findBid } from "../bid/service";
import { countCards, deleteCard, findCard, findCards, updateCard } from "../card/service";
import {
  sendAuctionEndedMail,
  sendBidPlacedMail,
  sendCardBoughtMail,
  sendCardTransferredToMail,
  sendHighestBidPlacedMail,
  sendReferralLinkUsed,
} from "../../shared/utils/mailer";
import { findUser } from "../user/service";
import { findReferral, updateManyReferral, updateReferral } from "../referral/service";
import { updateManySDKUsers } from "../sdk/service";
import { dateUTC } from "../../shared/utils/helpers";

const router = express.Router();

//# cron job endpoint
router.post(
  "/cron/check-auction",
  cronSenderIsValid,
  async function (_: Request, res: Response) {
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

        //# loop and end them.....
        for (let auctions of endedButActiveAuctions) {
          const owner = await findUser({ _id: auctions.owner });
          if (owner && owner.hasCompletedKYC && owner.email) {
            await sendAuctionEndedMail({
              cardId: auctions.identifier!,
              chainId: auctions.chainId as (typeof QUYX_NETWORKS)[number],
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
          const referredBy = decodedLog.args.referredBy;
          const amount = parseInt(ethers.utils.formatEther(decodedLog.args.amount));
          const timestamp = dateUTC(decodedLog.args.timestamp);

          //# find card that is listed & also an auction
          const card = await findCard({
            identifier: cardId,
            isForSale: true,
            isDeleted: false,
            isAuction: true,
          });

          //# found?
          if (card) {
            //# get the referral user
            const referalUser = await findUser({ address: referredBy });
            if (referalUser) {
              const referralInfo = await findReferral({
                user: referalUser._id,
                card: card._id,
              });

              //# incremenet bids placed on the link
              if (referralInfo) {
                updateReferral(
                  { _id: referralInfo._id },
                  { bidsPlaced: referralInfo.bidsPlaced + 1 }
                );
              }
            }

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
          const end = dateUTC(decodedLog.args.end);

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
            //# add the card ID
            await updateCard(
              { tempToken, chainId, owner: ownerDetails._id, isDeleted: false },
              { identifier: cardId }
            );
          }
        }

        if (decodedLog.name == "CardDeleted") {
          const cardId = parseInt(decodedLog.args.cardId.toString() as string);

          const card = await findCard({ identifier: cardId, chainId, isDeleted: false });
          //# card exists?
          if (card) {
            //# delete
            await deleteCard({ _id: card._id, isDeleted: false });
            //# update sdk users set card stuff to null
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
          const referredBy = decodedLog.args.referredBy;

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

            const referalUser = await findUser({ address: referredBy });
            if (referalUser) {
              updateReferral({ user: referalUser._id, card: card._id }, { won: true });
              if (referalUser.hasCompletedKYC && referalUser.email) {
                await sendReferralLinkUsed({
                  cardId,
                  email: referalUser.email,
                  chainId,
                  username: referalUser.username,
                });
              }
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
