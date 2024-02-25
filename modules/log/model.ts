import mongoose from "mongoose";

export interface LogDoc extends QuyxLog, mongoose.Document {}

const logSchema = new mongoose.Schema(
  {
    app: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "App",
      required: true,
    },
    dev: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dev",
      required: true,
    },
    status: {
      type: String,
      enum: ["failed", "successful"],
      required: true,
    },
    log: {
      type: String,
      default: null,
    },
    route: {
      type: String,
      required: true,
    },
    responseTime: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<LogDoc>("Log", logSchema);

export default Model;
