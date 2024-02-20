import mongoose from "mongoose";
import Sdk, { SdkDoc } from "./model";

export async function upsertSDKUser(
  filter: mongoose.FilterQuery<SdkDoc>,
  update: mongoose.UpdateQuery<QuyxSDKUser>
) {
  try {
    const user = await Sdk.findOneAndUpdate(
      filter,
      { $set: { ...update } },
      { upsert: true, new: true }
    );

    return user;
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

export async function updateSDKUser(
  filter: mongoose.FilterQuery<SdkDoc>,
  update: mongoose.UpdateQuery<QuyxSDKUser>
) {
  try {
    const result = await Sdk.updateOne(filter, update);
    return result.acknowledged && result.modifiedCount >= 1;
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

export async function updateManySDKUsers(
  filter: mongoose.FilterQuery<SdkDoc>,
  update: mongoose.UpdateQuery<QuyxSDKUser>
) {
  try {
    const result = await Sdk.updateMany(filter, update);
    return result.acknowledged && result.modifiedCount >= 1;
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

export async function findSDKUser(filter: mongoose.FilterQuery<SdkDoc>) {
  try {
    const result = await Sdk.findOne(filter).populate("card");
    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function countSDKUsers(filter: mongoose.FilterQuery<SdkDoc>) {
  try {
    const count = await Sdk.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findSDKUsers(
  filter: mongoose.FilterQuery<SdkDoc>,
  { limit, page }: FindProps
) {
  try {
    const result = await Sdk.find(filter)
      .populate("card")
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function deleteSDKUser(filter: mongoose.FilterQuery<SdkDoc>) {
  try {
    const result = await Sdk.updateOne(filter, { isActive: false });
    return result.acknowledged && result.modifiedCount >= 1;
  } catch (e: any) {
    throw new Error(e);
  }
}
