import { customAlphabet } from "nanoid";
import { generateUsername } from "unique-username-generator";
import { PublicKey } from "@solana/web3.js";
import bcryptjs from "bcryptjs";
import { Request } from "express";
import { get } from "lodash";
import crypto from "crypto";

export function isValidUsername(username: string) {
  return /^(?!.*?_$)[a-zA-Z][a-zA-Z0-9_]*(?<![_])$/.test(username);
}

export function getCacheKey(req: Request, address: string) {
  const origin = get(req, "headers.origin") ?? get(req, "headers.referer") ?? "x-fallback";

  const hash = crypto.createHash("sha256");
  hash.update(origin + address);

  return hash.digest("hex");
}

export function isValidAddress(address: string) {
  try {
    return PublicKey.isOnCurve(new PublicKey(address));
  } catch (e: any) {
    return false;
  }
}

export function generateOTP() {
  const nanoid = customAlphabet("0123456789", 6);
  return nanoid();
}

export function generateHash() {
  const nanoid = customAlphabet("abce012345abde6789f0dc", 32);
  return nanoid();
}

export function generateNonce() {
  const nanoid = customAlphabet("abce012345abde6789f0dc", 10);
  return nanoid();
}

export function generateUsernameSuggestion(username: string, rounds: number = 4) {
  const output = [];

  for (let i = 0; i < rounds; i++) {
    output[i] = generateUsername("", 4, username.length + 4, username);
  }

  return output;
}

export async function hashPassword(password: string) {
  const salt = await bcryptjs.genSalt(10);
  const hashedPassword = await bcryptjs.hash(password, salt);

  return hashedPassword;
}

export async function comparePasswords(password: string, passwordHash: string) {
  return await bcryptjs.compare(password, passwordHash);
}

export function dateUTC(date?: string | number | Date) {
  let dt = new Date();
  if (date) dt = new Date(date);

  return new Date(
    Date.UTC(
      dt.getFullYear(),
      dt.getMonth(),
      dt.getDate(),
      dt.getHours(),
      dt.getMinutes(),
      dt.getSeconds()
    )
  );
}
