import express, { Request, Response } from "express";
import {
  countCards,
  findCards,
  findTotalTags,
  getTags,
  getTopCardsSortedByVersion,
} from "../card/service";
import { findTopSellers } from "../user/service";

const router = express.Router();

//# all tags
router.get("/tags/all", async function (req: Request, res: Response) {
  try {
    const { limit = "10", page = "1" } = req.query as any;
    if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

    const totalTags = await findTotalTags();
    const resp = await getTags({
      page: parseInt(page),
      limit: parseInt(limit),
    });

    return res.json({
      status: true,
      message: "Fetched tags",
      data: resp,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        total: totalTags,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

//# all cards under a tag
router.get("/tags/cards/:tag", async function (req: Request, res: Response) {
  try {
    const { tag } = req.params;
    if (!tag || typeof tag !== "string") return res.sendStatus(400);

    const { limit = "10", page = "1" } = req.query as any;
    if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

    const filter = { tags: tag, isDeleted: false, isForSale: true };
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
      status: false,
      message: e.message,
    });
  }
});

//# 5 tags
router.get("/tags/trending", async function (req: Request, res: Response) {
  try {
    const tags = await getTags({ page: 1, limit: 5 });
    const limit = 12;
    const data: Record<string, QuyxCard[]> = {};

    for (let tag of tags) {
      const cards = await findCards(
        { tags: tag, isDeleted: false, isForSale: true },
        { limit, page: 1 }
      );

      data[tag._id] = cards;
    }

    return res.json({
      status: true,
      message: "Fetched cards",
      data,
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

//# all cards
router.get("/cards", async function (req: Request, res: Response) {
  try {
    const { limit = "10", page = "1" } = req.query as any;
    if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

    const filter = { isDeleted: false, isForSale: true };
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
      status: false,
      message: e.message,
    });
  }
});

//# by number of sold cards count
router.get("/top/sellers", async function (req: Request, res: Response) {
  try {
    const { limit = "10" } = req.query as any;
    if (isNaN(parseInt(limit))) return res.sendStatus(400);

    const users = await findTopSellers(parseInt(limit));

    return res.json({
      status: true,
      message: "Fetched top sellers",
      data: users,
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

//# by number of version
router.get("/top/cards/version", async function (req: Request, res: Response) {
  try {
    const { limit = "12" } = req.query as any;
    if (isNaN(parseInt(limit))) return res.sendStatus(400);

    const cards = await getTopCardsSortedByVersion(parseInt(limit));
    return res.json({
      status: true,
      message: "Fetched top cards by version",
      data: cards,
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

export = router;
