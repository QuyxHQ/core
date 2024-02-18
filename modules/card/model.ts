import mongoose from "mongoose";

export interface CardDoc extends QuyxCard, mongoose.Document {}

const cardSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    identifier: {
      type: Number,
      default: null,
    },
    version: {
      type: Number,
      default: null,
    },
    mintedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tempToken: {
      type: String,
      required: true,
      unique: true,
    },
    chainId: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      required: true,
    },
    pfp: {
      type: String,
      required: true,
    },
    bio: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    isForSale: {
      type: Boolean,
      default: false,
    },
    isAuction: {
      type: Boolean,
      default: null,
    },
    maxNumberOfBids: {
      type: Number,
      default: null,
    },
    aunctionEnds: {
      type: Date,
      default: null,
    },
    tags: [
      {
        type: String,
      },
    ],
    isFlagged: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<CardDoc>("Card", cardSchema);

export default Model;
