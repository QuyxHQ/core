import mongoose from "mongoose";
import { QUYX_USER } from "../../shared/utils/constants";

export interface SessionDoc extends QuyxSession, mongoose.Document {}

const sessionSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: QUYX_USER,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<SessionDoc>("Session", sessionSchema);

export default Model;
