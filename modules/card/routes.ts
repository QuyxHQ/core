import express, { Request, Response } from "express";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import validate from "../../shared/middlewares/validateSchema";
import {
  CheckForDuplicateCardUsername,
  CreateCard,
  EditCard,
  GetUserCard,
  checkForDuplicateCardUsername,
  createCardSchema,
  editCardSchema,
  getUserCardSchema,
} from "./schema";
import { countCards, createCard, findCard, findCards, updateCard } from "./service";
import { v4 as uuidv4 } from "uuid";
import { generateUsernameSuggestion } from "../../shared/utils/helpers";
import { findUser, getBoughtCards, getSoldCards } from "../user/service";
import { sendWebhook } from "../../shared/utils/webhook-sender";
import { omit } from "lodash";

const router = express.Router();

router.get(
  "/check-for-duplicate-username",
  validate(checkForDuplicateCardUsername),
  async function (
    req: Request<{}, {}, {}, CheckForDuplicateCardUsername["query"]>,
    res: Response
  ) {
    try {
      const { username } = req.query;

      const usernameOccurance = await countCards({ username, isDeleted: false });
      if (usernameOccurance == 0) {
        return res.status(200).json({
          status: true,
          message: "Username not taken",
        });
      }

      return res.status(409).json({
        status: false,
        message: "Username is already taken, try a new one",
        data: generateUsernameSuggestion(username),
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# Create new card
router.post(
  "/",
  canAccessRoute(QUYX_USER.USER),
  validate(createCardSchema),
  async function (req: Request<{}, {}, CreateCard["body"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const tempToken = uuidv4();

      const user = await findUser({ _id: identifier });
      if (!user?.hasCompletedKYC) {
        return res.status(400).json({
          status: false,
          message: "Kindly complete KYC before creating cards",
        });
      }

      const usernameOccurance = await countCards({
        username: req.body.username,
        isDeleted: false,
      });

      if (usernameOccurance > 0) {
        return res.status(409).json({
          status: false,
          message: "Username is already taken, try a new one",
        });
      }

      const resp = await createCard({
        ...req.body,
        owner: identifier,
        mintedBy: identifier,
        tempToken,
      });

      return res.status(201).json({
        status: true,
        message: "Card metadata created successfully!",
        data: resp,
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# editing a card
router.put(
  "/:cardId",
  canAccessRoute(QUYX_USER.USER),
  validate(editCardSchema),
  async function (
    req: Request<EditCard["params"], {}, EditCard["body"]>,
    res: Response<{}, QuyxLocals>
  ) {
    try {
      const { cardId } = req.params;
      const { identifier } = res.locals.meta;

      const card = await findCard({ identifier: cardId, isDeleted: false });
      if (!card) return res.sendStatus(404);

      if (String((card.owner as any)._id) !== identifier) return res.sendStatus(403);
      if (card.isForSale) {
        return res.status(409).json({
          status: false,
          message: "Cannot make changes to a card that is listed on marketplace",
        });
      }

      await updateCard({ identifier: cardId }, req.body);

      //# only call this if pfp, username or bio changes
      if (
        card.pfp != req.body.pfp ||
        card.username != req.body.username ||
        card.bio != req.body.bio
      ) {
        await sendWebhook(card.toJSON(), "event.card_updated"); // updated event
      }

      return res.status(201).json({
        status: true,
        message: "Card metadata updated successfully",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# all user cards (owned + mintedBy)
router.get(
  "/user/all/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { address } = req.params;
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const filter = { owner: user._id, mintedBy: user._id, isDeleted: false };
      const totalCards = await countCards(filter);
      const cards = await findCards(filter, { limit: parseInt(limit), page: parseInt(page) });

      return res.json({
        status: true,
        message: "Fetched cards",
        data: cards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalCards,
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: true,
        message: e.message,
      });
    }
  }
);

//# all user cards (owner)
router.get(
  "/user/owner/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { address } = req.params;
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const filter = { owner: user._id, isDeleted: false };
      const totalCards = await countCards(filter);
      const cards = await findCards(filter, { limit: parseInt(limit), page: parseInt(page) });

      return res.json({
        status: true,
        message: "Fetched cards",
        data: cards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalCards,
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: true,
        message: e.message,
      });
    }
  }
);

//# all cards created by user (minted by user)
router.get(
  "/user/created/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { address } = req.params;
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const filter = { mintedBy: user._id, isDeleted: false };
      const totalCards = await countCards(filter);
      const cards = await findCards(filter, { limit: parseInt(limit), page: parseInt(page) });

      return res.json({
        status: true,
        message: "Fetched cards",
        data: cards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalCards,
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: true,
        message: e.message,
      });
    }
  }
);

//# all cards sold by user
router.get(
  "/user/sold/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { address } = req.params;

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const cards = await getSoldCards(
        { _id: user._id },
        {
          limit: parseInt(limit),
          page: parseInt(page),
        }
      );

      return res.json({
        status: true,
        message: "Fetched cards",
        data: cards,
        pagination: {
          limit: parseInt(limit),
          page: parseInt(page),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: user.soldCards.length ?? 0,
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: true,
        message: e.message,
      });
    }
  }
);

//# all cards bought by user
router.get(
  "/user/bought/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { address } = req.params;

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const cards = await getBoughtCards(
        { _id: user._id },
        {
          limit: parseInt(limit),
          page: parseInt(page),
        }
      );

      return res.json({
        status: true,
        message: "Fetched cards",
        data: cards,
        pagination: {
          limit: parseInt(limit),
          page: parseInt(page),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: user.boughtCards.length ?? 0,
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: true,
        message: e.message,
      });
    }
  }
);

//# all user card that is for sale
router.get(
  "/user/sale/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { address } = req.params;
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const filter = { owner: user._id, isDeleted: false, isForSale: true };
      const totalCards = await countCards(filter);
      const cards = await findCards(filter, { limit: parseInt(limit), page: parseInt(page) });

      return res.json({
        status: true,
        message: "Fetched cards",
        data: cards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalCards,
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: true,
        message: e.message,
      });
    }
  }
);

//# Get single card
router.get("/:cardId", async function (req: Request, res: Response) {
  try {
    const { cardId } = req.params;
    if (typeof cardId != "string") return res.sendStatus(400);

    const card = await findCard({ identifier: cardId, isDeleted: false });
    if (!card) return res.sendStatus(404);

    return res.json({
      status: true,
      message: "Fetched card",
      data: omit(card.toJSON(), [
        "tempToken",
        "owner.email",
        "owner._id",
        "owner.__v",
        "owner.emailVerificationCode",
        "owner.emailVerificationCodeExpiry",
      ]),
    });
  } catch (e: any) {
    return res.status(500).json({
      status: true,
      message: e.message,
    });
  }
});

export = router;
