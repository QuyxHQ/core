import mongoose from "mongoose";
import Card, { CardDoc } from "./model";
import { dateUTC } from "../../shared/utils/helpers";

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

export async function findDistinctCard(field: string, chainId: string) {
  try {
    const result = await Card.distinct(field, {
      isDeleted: false,
      isForSale: true,
      chainId,
    });

    return result;
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
    const cards = await Card.find({ chainId })
      .sort({ version: -1, createdAt: -1 })
      .limit(limit);

    return cards;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function getTopTags(limit: number) {
  try {
    const hour24 = dateUTC();
    hour24.setHours(hour24.getHours() - 24);

    const topTags = await Card.aggregate([
      {
        $match: {
          createdAt: { $gte: hour24 },
          isDeleted: false,
          isForSale: true,
        },
      },
      { $unwind: "$tags" },
      {
        $group: {
          _id: "$tags",
          cardCount: { $sum: 1 },
        },
      },
      { $sort: { cardCount: -1 } },
      { $limit: limit },
    ]);

    console.log(topTags);

    return topTags as string[];
  } catch (e: any) {
    throw new Error(e);
  }
}
