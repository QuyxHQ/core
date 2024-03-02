import mongoose from "mongoose";
import Referral, { ReferralDoc } from "./model";

export async function createReferral(
  data: Omit<QuyxReferral, "isActive" | "clicks" | "won" | "bidsPlaced">
) {
  try {
    const resp = await Referral.create(data);
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

export async function updateReferral(
  filter: mongoose.FilterQuery<ReferralDoc>,
  update: mongoose.UpdateQuery<QuyxReferral>
) {
  try {
    const result = await Referral.updateOne(filter, update);
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

export async function updateManyReferral(
  filter: mongoose.FilterQuery<ReferralDoc>,
  update: mongoose.UpdateQuery<QuyxReferral>
) {
  try {
    const result = await Referral.updateOne(filter, update);
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

export async function findReferral(filter: mongoose.FilterQuery<ReferralDoc>) {
  try {
    const result = await Referral.findOne(filter).populate("card owner");
    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function countReferrals(filter?: mongoose.FilterQuery<ReferralDoc>) {
  try {
    const count = await Referral.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findReferrals(
  filter: mongoose.FilterQuery<ReferralDoc>,
  { limit, page }: FindProps,
  options?: { populateUser?: boolean; populateCard?: boolean }
) {
  try {
    if (options) {
      const referrals = await Referral.find(filter)
        .populate(options.populateCard ? "card" : "owner")
        .limit(limit)
        .skip((page - 1) * limit)
        .lean();

      return referrals;
    }

    const referrals = await Referral.find(filter)
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return referrals;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function deleteReferral(filter: mongoose.FilterQuery<ReferralDoc>) {
  try {
    const result = await Referral.updateOne(filter, { isActive: false });
    return result.acknowledged && result.modifiedCount >= 1;
  } catch (e: any) {
    throw new Error(e);
  }
}
