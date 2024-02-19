import { customAlphabet } from "nanoid";
import { generateUsername } from "unique-username-generator";
import bcryptjs from "bcryptjs";
import log from "./log";
import info from "../../contract/info.json";
import abi from "../../contract/abi.json";
import { ethers } from "ethers";
import config from "./config";

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

export async function endAuctionOnChain(
  chainId: (typeof QUYX_NETWORKS)[number],
  cardId: number
) {
  try {
    const data = info.find((item) => String(parseInt(item.chainId, 16)) == chainId);
    if (!data) throw new Error("unsupported chainId passed");

    const Provider = new ethers.providers.JsonRpcProvider(data.urls.rpc);
    const Signer = new ethers.Wallet(config.PRIVATE_KEY!, Provider);

    const Contract = new ethers.Contract(data.contractAddress, abi, Signer);
    await Contract.endAuction(cardId);
  } catch (e: any) {
    log.error(e);
    throw new Error(e);
  }
}
