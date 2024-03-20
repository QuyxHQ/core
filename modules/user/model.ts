import mongoose from "mongoose";

export interface UserDoc extends QuyxUser, mongoose.Document {}

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      default: null,
    },
    hasCompletedKYC: {
      type: Boolean,
      default: false,
    },
    emailVerificationCode: {
      type: String,
      default: null,
    },
    emailVerificationCodeExpiry: {
      type: Date,
      default: null,
    },
    hasBlueTick: {
      type: Boolean,
      default: false,
    },
    changedUsernameLastOn: {
      type: Date,
      default: null,
    },
    address: {
      type: String,
      required: true,
      unique: true,
    },
    pfp: {
      type: String,
      default: null,
    },
    boughtCards: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Card",
      },
    ],
    soldCards: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Card",
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<UserDoc>("User", userSchema);

export default Model;
