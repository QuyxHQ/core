import mongoose from "mongoose";

export interface DevDoc extends QuyxDev, mongoose.Document {}

const devSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    company: {
      type: String,
      default: null,
    },
    role: {
      type: String,
      default: null,
    },
    heardUsFrom: {
      type: String,
      default: null,
    },
    provider: {
      type: String,
      enum: ["google", "email"],
      default: "email",
    },
    password: {
      type: String,
      default: null,
    },
    verifiedPasswordLastOn: {
      type: Date,
      default: null,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    emailVerificationOTP: {
      type: String,
      default: null,
    },
    emailVerificationOTPExpiry: {
      type: Date,
      default: null,
    },
    forgetPasswordHash: {
      type: String,
      default: null,
    },
    forgetPasswordHashExpiry: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<DevDoc>("Dev", devSchema);

export default Model;
