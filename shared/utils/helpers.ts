import { customAlphabet } from "nanoid";
import { generateUsername } from "unique-username-generator";
import { PublicKey } from "@solana/web3.js";
import bcryptjs from "bcryptjs";
import { Request, Response } from "express";
import { get } from "lodash";
import crypto from "crypto";
import type { SolanaSignInInput, SolanaSignInOutput } from "@solana/wallet-standard-features";
import { verifySignIn } from "@solana/wallet-standard-util";
import config from "./config";

export function setCookie(res: Response, key: string, value: any, maxAge: number) {
  return res.cookie(key, value, {
    maxAge,
    httpOnly: true,
    sameSite: "lax",
    domain: config.IS_PROD ? ".quyx.xyz" : "localhost",
    path: "/",
    secure: config.IS_PROD, // sets it to true in prod!
  });
}

export function removeCookie(res: Response, key: string) {
  return res.cookie(key, "", {
    expires: new Date(0),
    httpOnly: true,
    secure: config.IS_PROD,
  });
}

export function verifySIWS(input: SolanaSignInInput, output: SolanaSignInOutput): boolean {
  const serialisedOutput: SolanaSignInOutput = {
    account: {
      ...output.account,
      publicKey: new Uint8Array(output.account.publicKey),
    },
    signature: new Uint8Array(output.signature),
    signedMessage: new Uint8Array(output.signedMessage),
  };

  return verifySignIn(input, serialisedOutput);
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
