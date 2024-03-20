import express, { Request, Response } from "express";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import validate from "../../shared/middlewares/validateSchema";
import {
  addToBookmarkSchema,
  AddToBookmark,
  removeFromBookmarkSchema,
  RemoveFromBookmark,
  GetBookmark,
  getBookmarkSchema,
} from "./schema";
import {
  addToBookmark,
  alreadyInBookmark,
  countBookmarks,
  findBookmarks,
  removeFromBookmark,
} from "./service";
import { omit } from "lodash";

const router = express.Router();

//# saving a card
router.post(
  "/",
  canAccessRoute(QUYX_USER.USER),
  validate(addToBookmarkSchema),
  async function (req: Request<{}, {}, AddToBookmark["body"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const isAlreadyBookmarked = await alreadyInBookmark(identifier, req.body.card);
      if (isAlreadyBookmarked) {
        return res.status(200).json({
          status: false,
          message: "Card is already in bookmark",
        });
      }

      const bookmark = await addToBookmark({
        user: identifier,
        card: req.body.card,
      });

      return res.status(201).json({
        status: true,
        message: "Card add to bookmark successfully!",
        data: omit(bookmark.toJSON(), ["_id"]),
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# is in bookmark already
router.get(
  "/:card",
  canAccessRoute(QUYX_USER.USER),
  validate(getBookmarkSchema),
  async function (req: Request<GetBookmark["params"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { card } = req.params;

      const result = await alreadyInBookmark(identifier, card);

      return res.status(200).json({
        status: true,
        message: "Status fetched",
        data: { isBookmarked: result },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# removing from bookmark
router.delete(
  "/:card",
  canAccessRoute(QUYX_USER.USER),
  validate(removeFromBookmarkSchema),
  async function (req: Request<RemoveFromBookmark["params"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { card } = req.params;

      const resp = await removeFromBookmark(identifier, card);
      if (!resp) return res.sendStatus(400);

      return res.status(201).json({
        status: true,
        message: "Card removed from bookmark successfully",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# gets all users bookmark
router.get(
  "/",
  canAccessRoute(QUYX_USER.USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { identifier } = res.locals.meta;

      const totalBookmarks = await countBookmarks({ user: identifier });
      const bookmarks = await findBookmarks({
        param: identifier,
        limit: parseInt(limit),
        page: parseInt(page),
      });

      return res.json({
        status: true,
        message: "Fetched bookmarks",
        data: bookmarks,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalBookmarks,
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
