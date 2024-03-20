import { z } from "zod";

export const checkForDuplicateUsername = z.object({
  query: z.object({
    username: z.string(),
  }),
});

export const SIWSSchema = z.object({
  body: z.object({
    message: z.strictObject({
      domain: z.string(),
      address: z.string(),
      statement: z.string(),
      chainId: z.enum(["devnet", "mainnet", "testnet"]),
      nonce: z.string(),
      expirationTime: z.string(),
      issuedAt: z.string(),
    }),
    signature: z.instanceof(Uint8Array),
  }),
});

export const editUserSchema = z.object({
  body: z.strictObject({
    pfp: z.string().url().nullable(),
    username: z.string(),
    email: z.string().email(),
  }),
});

export const verifyKYC = z.object({
  body: z.strictObject({
    otp: z.string().length(6),
  }),
});

export const searchUserSchema = z.object({
  query: z.object({
    q: z.string(),
  }),
});

export type CheckForDuplicateUsername = z.TypeOf<typeof checkForDuplicateUsername>;
export type SIWS = z.TypeOf<typeof SIWSSchema>;
export type EditUser = z.TypeOf<typeof editUserSchema>;
export type VerifyKYC = z.TypeOf<typeof verifyKYC>;
export type SearchUser = z.TypeOf<typeof searchUserSchema>;
