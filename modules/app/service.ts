import mongoose from "mongoose";
import App, { AppDoc } from "./model";

export async function registerApp(data: Omit<QuyxApp, "isActive">) {
  try {
    const result = await App.create(data);
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

export async function updateApp(
  filter: mongoose.FilterQuery<AppDoc>,
  update: mongoose.UpdateQuery<QuyxApp>
) {
  try {
    const result = await App.updateOne(filter, update);
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

export async function findApp(filter: mongoose.FilterQuery<AppDoc>) {
  try {
    const result = await App.findOne(filter);
    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function countApps(filter?: mongoose.FilterQuery<AppDoc>) {
  try {
    const count = await App.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findApps(
  filter: mongoose.FilterQuery<AppDoc>,
  { limit, page }: FindProps
) {
  try {
    const result = await App.find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function deleteApp(filter: mongoose.FilterQuery<AppDoc>) {
  try {
    const result = await App.updateOne(filter, { isActive: false });
    return result.acknowledged && result.modifiedCount >= 1;
  } catch (e: any) {
    throw new Error(e);
  }
}
