import mongoose from "mongoose";

export interface BookmarkDoc extends QuyxBookmark, mongoose.Document {}

const bookmarkSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<BookmarkDoc>("Bookmark", bookmarkSchema);

export default Model;
