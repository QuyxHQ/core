import express, { Request, Response } from "express";
import { countCards, findCards, findDistinctCard, getTopTags } from "../card/service";
import { findTopSellers } from "../user/service";
import { getTopCardsSortedByMostBids } from "../bid/service";

const router = express.Router();

//# all tags
router.get("/tags/:chainId", async function (req: Request, res: Response) {
  try {
    const { chainId } = req.params;
    if (!chainId || typeof chainId !== "string") return res.sendStatus(400);

    const tags = (await findDistinctCard("tags", chainId)) as unknown as string[];
    return res.json({
      status: true,
      message: "fetched tags",
      data: tags,
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

//# all cards under a tag
router.get("/tags/:chainId/:tag", async function (req: Request, res: Response) {
  try {
    const { tag, chainId } = req.params;
    if (!tag || typeof tag !== "string" || !chainId || typeof chainId !== "string") {
      return res.sendStatus(400);
    }

    const { limit = "10", page = "1" } = req.query as any;
    if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

    const totalCards = await countCards({
      tags: tag,
      chainId,
      isDeleted: false,
      isForSale: true,
    });

    const cards = await findCards(
      { tags: tag, chainId, isDeleted: false, isForSale: true },
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
      status: false,
      message: e.message,
    });
  }
});

//# 5 tags
router.get("/tags/trending/:chainId", async function (req: Request, res: Response) {
  try {
    const { chainId } = req.params;
    if (!chainId || typeof chainId !== "string") return res.sendStatus(400);

    const tags = await getTopTags(5);
    const limit = 12;
    const data: Record<any, any> = {};

    for (let tag of tags) {
      const cards = await findCards(
        { tags: tag, chainId, isDeleted: false, isForSale: true },
        { limit, page: 1 }
      );

      data[tag] = cards;
    }

    return res.json({
      status: true,
      message: "fetched cards",
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
router.get("/cards/:chainId", async function (req: Request, res: Response) {
  try {
    const { chainId } = req.params;
    if (!chainId || typeof chainId !== "string") return res.sendStatus(400);

    const { limit = "10", page = "1" } = req.query as any;
    if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

    const totalCards = await countCards({ chainId, isDeleted: false, isForSale: true });
    const cards = await findCards(
      { chainId, isDeleted: false, isForSale: true },
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
      message: "fetched top sellers",
      data: users,
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

//# by number of bids
router.get("/top/cards/:chainId", async function (req: Request, res: Response) {
  try {
    const { chainId } = req.params;
    if (!chainId || typeof chainId !== "string") return res.sendStatus(400);

    const { limit = "10" } = req.query as any;
    if (isNaN(parseInt(limit))) return res.sendStatus(400);

    const cards = await getTopCardsSortedByMostBids(parseInt(limit), chainId);
    return res.json({
      status: true,
      message: "fetched top cards",
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
