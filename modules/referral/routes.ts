import express, { Request, Response } from "express";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import validate from "../../shared/middlewares/validateSchema";
import {
  CreateReferralLink,
  GetReferral,
  createReferrallLinkSchema,
  getReferralSchema,
} from "./schema";
import {
  countReferrals,
  createReferral,
  findReferral,
  findReferrals,
  updateReferral,
} from "./service";
import { findCard } from "../card/service";
import config from "../../shared/utils/config";
import { dateUTC } from "../../shared/utils/helpers";

const router = express.Router();

//# creates referall link
router.post(
  "/",
  canAccessRoute(QUYX_USER.USER),
  validate(createReferrallLinkSchema),
  async function (
    req: Request<{}, {}, CreateReferralLink["body"]>,
    res: Response<{}, QuyxLocals>
  ) {
    try {
      const { identifier } = res.locals.meta;
      const { card } = req.body;

      const existOccurence = await countReferrals({ user: identifier, card, isActive: true });
      if (existOccurence > 0) {
        return res.status(409).json({
          status: false,
          message: "you still have an active referral link for this card",
        });
      }

      const _card = await findCard({ _id: card });
      if (!_card) return res.sendStatus(404);

      if (!_card.isForSale) {
        return res.status(409).json({
          status: false,
          message: "cannot generate referral link for a card that is not listed",
        });
      }

      if (
        _card.isAuction &&
        _card.auctionEnds &&
        dateUTC().getTime() > dateUTC(_card.auctionEnds).getTime()
      ) {
        return res.status(409).json({
          status: false,
          message: "auction has ended, unable to crete link",
        });
      }

      const referral = await createReferral({ card, user: identifier });
      return res.status(201).json({
        status: true,
        message: "referral link created successfully!",
        data: {
          ref: referral._id,
          link: `${config.CLIENT_BASE_URL}?ref=${referral._id}`,
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

//# updating referral click count
router.put(
  "/:ref",
  validate(getReferralSchema),
  async function (req: Request<GetReferral["params"]>, res: Response) {
    try {
      const { ref } = req.params;

      const referral = await findReferral({ _id: ref });
      if (!referral) return res.sendStatus(404);

      await updateReferral({ _id: referral._id }, { clicks: referral.clicks + 1 });
      return res.status(201).json({
        status: true,
        message: "click count updated successfully",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# gets all active referral link of the logged in user
router.get(
  "/active",
  canAccessRoute(QUYX_USER.USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { identifier } = res.locals.meta;

      const totalReferrals = await countReferrals({ user: identifier, isActive: true });
      const referrals = await findReferrals(
        { user: identifier, isActive: true },
        { limit: parseInt(limit), page: parseInt(page) },
        { populateCard: true }
      );

      return res.json({
        status: true,
        message: "fetched referal links",
        data: referrals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalReferrals,
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

//# gets all inactive referral link of the logged in user
router.get(
  "/inactive",
  canAccessRoute(QUYX_USER.USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { identifier } = res.locals.meta;

      const totalReferrals = await countReferrals({
        user: identifier,
        isActive: false,
      });
      const referrals = await findReferrals(
        { user: identifier, isActive: true },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched referal links",
        data: referrals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalReferrals,
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

//# gets single referral details
router.get(
  "/single/:ref",
  validate(getReferralSchema),
  async function (req: Request<GetReferral["params"]>, res: Response) {
    try {
      const { ref } = req.params;

      const referral = await findReferral({ _id: ref });
      if (!referral) return res.sendStatus(404);

      return res.json({
        status: true,
        message: "referral fetched successfully",
        data: referral,
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
