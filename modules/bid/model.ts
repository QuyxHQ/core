import mongoose from "mongoose";

export interface BidDoc extends QuyxBid, mongoose.Document {}

const bidSchema = new mongoose.Schema(
  {
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
      required: true,
    },
    version: {
      type: Number,
      required: true,
    },
    bidder: {
      type: String,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<BidDoc>("Bid", bidSchema);

export default Model;
