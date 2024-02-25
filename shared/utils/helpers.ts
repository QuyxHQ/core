import { customAlphabet } from "nanoid";
import { generateUsername } from "unique-username-generator";
import bcryptjs from "bcryptjs";

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
  let now = new Date();
  if (date) now = new Date(date);

  return new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds()
    )
  );
}
