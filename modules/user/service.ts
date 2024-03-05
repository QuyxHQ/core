import mongoose from "mongoose";
import User, { UserDoc } from "./model";
import { CardDoc } from "../card/model";

export async function updateUser(
  filter: mongoose.FilterQuery<UserDoc>,
  data: mongoose.UpdateQuery<QuyxUser>
) {
  try {
    const result = await User.updateOne(filter, data);
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

export async function upsertUser(address: string, update: mongoose.UpdateQuery<QuyxUser>) {
  try {
    const user = await User.findOneAndUpdate(
      { address },
      { $set: { ...update } },
      { upsert: true, new: true }
    );

    return user;
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

export function findUser(filter: mongoose.FilterQuery<UserDoc>) {
  try {
    const user = User.findOne(filter);
    return user;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function countUsers(filter?: mongoose.FilterQuery<UserDoc>) {
  try {
    const count = await User.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findUsers(
  filter: mongoose.FilterQuery<UserDoc>,
  { limit, page }: FindProps
) {
  try {
    const result = await User.find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return result;
  } catch (e: any) {
    console.log(e);

    throw new Error(e);
  }
}

export async function findTopSellers(limit = 10) {
  try {
    const result = await User.find()
      .sort({
        createdAt: -1,
      })
      .limit(limit)
      .lean();
    return result;
  } catch (e: any) {
    console.log(e);

    throw new Error(e);
  }
}

export async function increaseCardCount(
  filter: mongoose.FilterQuery<CardDoc>,
  chainId: string,
  field: "cardsCreatedCount" | "cardsSoldCount" | "cardsBoughtCount"
) {
  try {
    const user = await User.findOne(filter);
    if (!user) throw new Error("invalid filter props, user not found");

    const index = user[field].findIndex((item) => item.chainId === chainId);
    if (index !== -1) user[field][index].count += 1;
    else user[field].push({ chainId, count: 1 });

    await user.save();
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function addBoughtCards(
  filter: mongoose.FilterQuery<CardDoc> & { chainId: string },
  card: string
) {
  try {
    const user = await User.findOne(filter);
    if (!user) throw new Error("invalid filter props, user not found");

    const index = user.boughtCards.findIndex((item) => item.chainId === filter.chainId);
    if (index !== -1) user.boughtCards[index].cards.push(card);
    else user.boughtCards.push({ chainId: filter.chainId, cards: [card] });

    await user.save();
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function addSoldCards(
  filter: mongoose.FilterQuery<CardDoc> & { chainId: string },
  card: string
) {
  try {
    const user = await User.findOne(filter);
    if (!user) throw new Error("invalid filter props, user not found");

    const index = user.soldCards.findIndex((item) => item.chainId === filter.chainId);
    if (index !== -1) user.soldCards[index].cards.push(card);
    else user.soldCards.push({ chainId: filter.chainId, cards: [card] });

    await user.save();
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function getBoughtCards(
  filter: mongoose.FilterQuery<CardDoc> & { chainId: string },
  { limit, page }: FindProps
) {
  try {
    const skip = (page - 1) * limit;

    const user = await User.findOne(filter).populate({
      path: "boughtCards.cards",
      options: {
        skip,
        limit,
      },
    });

    if (!user) throw new Error("invalid filter props, user not found");
    const result = user.boughtCards.find((item) => item.chainId === filter.chainId);
    if (!result) return [];

    return result.cards as unknown as QuyxCard[];
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function getSoldCards(
  filter: mongoose.FilterQuery<CardDoc> & { chainId: string },
  { limit, page }: FindProps
) {
  try {
    const skip = (page - 1) * limit;

    const user = await User.findOne(filter).populate({
      path: "soldCards.cards",
      options: {
        skip,
        limit,
      },
    });

    if (!user) throw new Error("invalid filter props, user not found");
    const result = user.soldCards.find((item) => item.chainId === filter.chainId);
    if (!result) return [];

    return result.cards as unknown as QuyxCard[];
  } catch (e: any) {
    throw new Error(e);
  }
}
