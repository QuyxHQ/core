import mongoose from "mongoose";
import Bookmark, { BookmarkDoc } from "./model";

export async function addToBookmark(data: QuyxBookmark) {
  try {
    const result = await Bookmark.create(data);

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

export async function removeFromBookmark(user: string, card: string) {
  try {
    const result = await Bookmark.deleteOne({ card, user });
    return result.acknowledged && result.deletedCount >= 1;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function alreadyInBookmark(user: string, card: string) {
  try {
    const resp = await Bookmark.countDocuments({ user, card });
    return resp >= 1;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function countBookmarks(filter?: mongoose.FilterQuery<BookmarkDoc>) {
  try {
    const count = await Bookmark.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findBookmarks({
  param,
  limit = 10,
  page = 1,
}: FindProps & { param: string }) {
  try {
    const filter = { $or: [{ user: param }, { card: param }] };

    const result = await Bookmark.find(filter)
      .populate("card")
      .limit(limit)
      .skip((page - 1) * limit)
      .lean(true);

    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}
