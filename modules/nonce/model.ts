import mongoose from "mongoose";

export interface NonceDoc extends QuyxNonce, mongoose.Document {}

const nonceSchema = new mongoose.Schema(
  {
    nonce: {
      type: String,
      required: true,
      unique: true,
    },
    issuedAt: {
      type: Date,
      required: true,
    },
    expirationTime: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<NonceDoc>("Nonce", nonceSchema);

export default Model;
