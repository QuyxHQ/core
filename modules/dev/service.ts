import mongoose from "mongoose";
import Dev, { DevDoc } from "./model";

export async function createDev(
  data: Omit<
    QuyxDev,
    | "verifiedPasswordLastOn"
    | "isEmailVerified"
    | "forgetPasswordHash"
    | "forgetPasswordHashExpiry"
    | "role"
    | "heardUsFrom"
    | "provider"
  >
) {
  try {
    const resp = await Dev.create(data);
    return resp;
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

export async function upsertDev(
  filter: mongoose.FilterQuery<DevDoc>,
  update: mongoose.UpdateQuery<QuyxDev>
) {
  try {
    const result = await Dev.findOneAndUpdate(filter, update, { upsert: true, new: true });
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

export async function updateDev(
  filter: mongoose.FilterQuery<DevDoc>,
  update: mongoose.UpdateQuery<QuyxDev>
) {
  try {
    const result = await Dev.updateOne(filter, update);
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

export async function findDev(filter: mongoose.FilterQuery<DevDoc>) {
  try {
    const dev = await Dev.findOne(filter);
    return dev;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function countDevs(filter?: mongoose.FilterQuery<DevDoc>) {
  try {
    const count = await Dev.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findDevs(
  filter: mongoose.FilterQuery<DevDoc>,
  { limit, page }: FindProps
) {
  try {
    const result = await Dev.find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}
