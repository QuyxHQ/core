import mongoose from "mongoose";
import { QUYX_NETWORKS } from "../../shared/utils/constants";

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
      unique: true,
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
    cardsCreatedCount: [
      {
        chainId: {
          type: String,
          enum: QUYX_NETWORKS,
        },
        count: {
          type: Number,
          default: 0,
        },
      },
    ],
    cardsSoldCount: [
      {
        chainId: {
          type: String,
          enum: QUYX_NETWORKS,
        },
        count: {
          type: Number,
          default: 0,
        },
      },
    ],
    cardsBoughtCount: [
      {
        chainId: {
          type: String,
          enum: QUYX_NETWORKS,
        },
        count: {
          type: Number,
          default: 0,
        },
      },
    ],
    boughtCards: [
      {
        chainId: {
          type: String,
          enum: QUYX_NETWORKS,
        },
        cards: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Card",
          },
        ],
      },
    ],
    soldCards: [
      {
        chainId: {
          type: String,
          enum: QUYX_NETWORKS,
        },
        cards: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Card",
          },
        ],
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<UserDoc>("User", userSchema);

export default Model;
