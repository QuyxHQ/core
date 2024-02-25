import mongoose from "mongoose";

export interface AiWaitlistDoc extends QuyxAiWaitlist, mongoose.Document {}

const aiWaitlistSchema = new mongoose.Schema(
  {
    dev: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Dev",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Model = mongoose.model<AiWaitlistDoc>("AiWaitlist", aiWaitlistSchema);

export default Model;
