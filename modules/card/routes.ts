import express, { Request, Response } from "express";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import validate from "../../shared/middlewares/validateSchema";
import {
  CreateCard,
  EditCard,
  GetUserCard,
  createCardSchema,
  editCardSchema,
  getUserCardSchema,
} from "./schema";
import { countCards, createCard, findCard, findCards, updateCard } from "./service";
import { v4 as uuidv4 } from "uuid";
import { generateUsernameSuggestion } from "../../shared/utils/helpers";
import { findUser, getBoughtCards, getSoldCards, increaseCardCount } from "../user/service";

const router = express.Router();

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
      if (!user!.hasCompletedKYC) {
        return res.status(400).json({
          status: false,
          message: "kindly complete KYC before creating cards",
        });
      }

      const usernameOccurance = await countCards({
        username: req.body.username,
        isDeleted: true,
      });

      if (usernameOccurance > 0) {
        return res.status(409).json({
          status: false,
          message: "username is already taken, try a new one",
          data: {
            suggestions: generateUsernameSuggestion(req.body.username),
          },
        });
      }

      const resp = await createCard({
        ...req.body,
        owner: identifier,
        mintedBy: identifier,
        tempToken,
      });

      await increaseCardCount(
        { _id: user!._id, chainId: req.body.chainId },
        "cardsCreatedCount"
      );

      return res.status(201).json({
        status: true,
        message: "card created successfully!",
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
  "/:chainId/:cardId",
  canAccessRoute(QUYX_USER.USER),
  validate(editCardSchema),
  async function (
    req: Request<EditCard["params"], {}, EditCard["body"]>,
    res: Response<{}, QuyxLocals>
  ) {
    try {
      const { chainId, cardId } = req.params;
      const { identifier } = res.locals.meta;

      const card = await findCard({ identifier: cardId, chainId, isDeleted: false });
      if (!card) return res.sendStatus(404);

      if (String(card.owner) !== identifier) return res.sendStatus(403);
      if (card.isForSale) {
        return res.status(409).json({
          status: false,
          message: "cannot edit a card that is listed",
        });
      }

      await updateCard({ identifier: cardId, chainId }, req.body);
      return res.status(201).json({
        status: true,
        message: "card updated successfully",
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
  "/user/all/:chainId/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { address, chainId } = req.params;
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const totalCards = await countCards({
        owner: user._id,
        mintedBy: user._id,
        chainId,
        isDeleted: false,
      });

      const cards = await findCards(
        { owner: user._id, mintedBy: user._id, chainId, isDeleted: false },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched cards",
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
  "/user/created/:chainId/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { address, chainId } = req.params;
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const totalCards = await countCards({
        mintedBy: user._id,
        chainId,
        isDeleted: false,
      });

      const cards = await findCards(
        { mintedBy: user._id, chainId, isDeleted: false },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched cards",
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
  "/user/sold/:chainId/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { address, chainId } = req.params;

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const cards = await getSoldCards(
        { _id: user._id, chainId },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched cards",
        data: cards,
        pagination: {
          limit: parseInt(limit),
          page: parseInt(page),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: user.soldCards[chainId].cards.length,
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
  "/user/bought/:chainId/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { address, chainId } = req.params;

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const cards = await getBoughtCards(
        { _id: user._id, chainId },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched cards",
        data: cards,
        pagination: {
          limit: parseInt(limit),
          page: parseInt(page),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: user.boughtCards[chainId].cards.length,
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
  "/user/sale/:chainId/:address",
  validate(getUserCardSchema),
  async function (req: Request<GetUserCard["params"]>, res: Response) {
    try {
      const { address, chainId } = req.params;
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const user = await findUser({ address });
      if (!user) return res.sendStatus(404);

      const totalCards = await countCards({
        owner: user._id,
        isDeleted: false,
        chainId,
        isForSale: true,
      });

      const cards = await findCards(
        { owner: user._id, isDeleted: false, chainId, isForSale: true },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched cards",
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
router.get("/:chainId/:cardId", async function (req: Request, res: Response) {
  try {
    const { cardId, chainId } = req.params;
    if (typeof cardId != "string" || typeof chainId != "string") {
      return res.sendStatus(400);
    }

    const card = await findCard({ identifier: cardId, chainId, isDeleted: false });
    if (!card) return res.sendStatus(404);

    return res.json({
      status: true,
      message: "fetched card",
      data: card,
    });
  } catch (e: any) {
    return res.status(500).json({
      status: true,
      message: e.message,
    });
  }
});

export = router;
