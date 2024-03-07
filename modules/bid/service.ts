import mongoose from "mongoose";
import Bid, { BidDoc } from "./model";

export async function addBid(data: QuyxBid) {
  try {
    const resp = await Bid.create(data);
    return resp;
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

export async function updateBid(
  filter: mongoose.FilterQuery<BidDoc>,
  update: mongoose.UpdateQuery<QuyxBid>
) {
  try {
    const result = await Bid.updateOne(filter, update);
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

export async function findBid(filter: mongoose.FilterQuery<BidDoc>) {
  try {
    const bid = await Bid.findOne(filter);
    return bid;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function countBids(filter?: mongoose.FilterQuery<BidDoc>) {
  try {
    const count = await Bid.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findBids(
  filter: mongoose.FilterQuery<BidDoc>,
  { limit, page }: FindProps
) {
  try {
    const result = await Bid.find(filter)
      .populate("card")
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function getTopCardsSortedByMostBids(
  limit: number,
  chainId: string
): Promise<({ _id: string } & QuyxCard)[]> {
  try {
    const topCardsSortedByMostBids = await Bid.aggregate([
      {
        $group: {
          _id: "$card",
          totalBids: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "cards",
          localField: "_id",
          foreignField: "_id",
          as: "cardDetails",
        },
      },
      { $unwind: "$cardDetails" },
      {
        $match: {
          "cardDetails.isForSale": true,
          "cardDetails.isAuction": true,
          "cardDetails.isDeleted": false,
          "cardDetails.chainId": chainId,
        },
      },
      { $match: { version: "$cardDetails.version" } },
      { $sort: { totalBids: -1 } },
      { $limit: limit },
    ]);

    return topCardsSortedByMostBids;
  } catch (e: any) {
    throw new Error(e);
  }
}
