import mongoose from "mongoose";

export interface AppDoc extends QuyxApp, mongoose.Document {}

const appSchema = new mongoose.Schema(
  {
    apiKey: {
      type: String,
      required: true,
      unique: true,
    },
    clientID: {
      type: String,
      required: true,
      unique: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dev",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    webhook: {
      type: String,
      default: null,
    },
    allowedDomains: [{ type: String }],
    allowedBundleIDs: [{ type: String }],
    blacklistedAddresses: [{ type: String }],
    whitelistedAddresses: [{ type: String }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<AppDoc>("App", appSchema);

export default Model;
