import mongoose from "mongoose";
import Card, { CardDoc } from "./model";

export async function createCard(
  data: Omit<
    QuyxCard,
    | "identifier"
    | "version"
    | "isDeleted"
    | "isFlagged"
    | "isForSale"
    | "isAuction"
    | "listingPrice"
    | "maxNumberOfBids"
    | "auctionEnds"
  >
) {
  try {
    const result = await Card.create(data);
    return result;
  } catch (e: any) {
    if (e && e instanceof mongoose.Error.ValidationError) {
      for (let field in e.errors) {
        const errorMsg = e.errors[field].message;

        throw new Error(errorMsg);
      }
    }

    throw new Error(e);
  }
}

export async function updateCard(
  filter: mongoose.FilterQuery<CardDoc>,
  update: mongoose.UpdateQuery<QuyxCard>
) {
  try {
    const result = await Card.updateOne(filter, update);
    return result.acknowledged && result.modifiedCount >= 1;
  } catch (e: any) {
    if (e && e instanceof mongoose.Error.ValidationError) {
      for (let field in e.errors) {
        const errorMsg = e.errors[field].message;

        throw new Error(errorMsg);
      }
    }

    throw new Error(e);
  }
}

export async function findCard(filter: mongoose.FilterQuery<CardDoc>) {
  try {
    const card = await Card.findOne(filter).populate("owner");
    return card;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findTotalTags(chainId: string) {
  try {
    const totalTags = await Card.aggregate([
      { $match: { chainId, isForSale: true, isDeleted: false } },
      { $unwind: "$tags" },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]);

    return (totalTags[0]?.count as number) || 0;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function getTags(chainId: string, { page = 1, limit = 10 }) {
  try {
    const skip = (page - 1) * limit;

    const tags = await Card.aggregate([
      { $match: { chainId, isForSale: true, isDeleted: false } },
      { $unwind: "$tags" },
      { $group: { _id: "$tags", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $skip: skip },
      { $limit: limit },
    ]);

    return tags as { _id: string; count: number }[];
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function countCards(filter?: mongoose.FilterQuery<CardDoc>) {
  try {
    const count = await Card.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findCards(
  filter: mongoose.FilterQuery<CardDoc>,
  { limit, page }: FindProps
) {
  try {
    const cards = await Card.find(filter)
      .populate("owner")
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return cards;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function deleteCard(filter: mongoose.FilterQuery<CardDoc>) {
  try {
    const result = await Card.updateOne(filter, { isDeleted: true });
    return result.acknowledged && result.modifiedCount >= 1;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function getTopCardsSortedByVersion(limit: number, chainId: string) {
  try {
    const cards = await Card.find({ chainId, isForSale: true, isDeleted: false })
      .populate("owner")
      .sort({ version: -1, createdAt: -1 })
      .limit(limit);

    return cards;
  } catch (e: any) {
    throw new Error(e);
  }
}
