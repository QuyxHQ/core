import mongoose from "mongoose";
import Nonce, { NonceDoc } from "./model";

export async function addNonce(data: QuyxNonce) {
  try {
    const resp = await Nonce.create(data);
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

export async function countNonce(filter?: mongoose.FilterQuery<NonceDoc>) {
  try {
    const result = await Nonce.countDocuments(filter);
    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findNonce(filter: mongoose.FilterQuery<NonceDoc>) {
  try {
    const result = await Nonce.findOne(filter);
    return result;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function deleteNonce(filter: mongoose.FilterQuery<NonceDoc>) {
  try {
    const result = await Nonce.deleteOne(filter);
    return result.acknowledged && result.deletedCount >= 1;
  } catch (e: any) {
    throw new Error(e);
  }
}
