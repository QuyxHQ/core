import mongoose from "mongoose";
import AiWaitlist, { AiWaitlistDoc } from "./model";

export async function addToAiWaitlist(data: QuyxAiWaitlist) {
  try {
    const result = await AiWaitlist.create(data);
    return result;
  } catch (e: any) {
    if (e && e instanceof mongoose.Error.ValidationError) {
      for (let field in e.errors) {
        const errorMsg = e.errors[field].message;

        throw new Error(errorMsg);
      }
    }

    throw new Error(e);
  }
}

export async function findAiWaitlist(filter: mongoose.FilterQuery<AiWaitlistDoc>) {
  try {
    const result = await AiWaitlist.findOne(filter);
    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function countAiWaitlist(filter?: mongoose.FilterQuery<AiWaitlistDoc>) {
  try {
    const count = await AiWaitlist.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findAiWaitlists(
  filter: mongoose.FilterQuery<AiWaitlistDoc>,
  { limit, page }: FindProps
) {
  try {
    const result = await AiWaitlist.find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function removeFromAiWaitlist(filter: mongoose.FilterQuery<AiWaitlistDoc>) {
  try {
    const result = await AiWaitlist.deleteOne(filter);
    return result.acknowledged && result.deletedCount >= 1;
  } catch (e: any) {
    throw new Error(e);
  }
}
