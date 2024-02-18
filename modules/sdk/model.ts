import mongoose from "mongoose";

export interface SdkDoc extends QuyxSDKUser, mongoose.Document {}

const sdkSchema = new mongoose.Schema(
  {
    app: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "App",
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    card: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Card",
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<SdkDoc>("Sdk", sdkSchema);

export default Model;
