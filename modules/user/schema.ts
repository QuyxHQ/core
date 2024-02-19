import { z } from "zod";

export const SIWESchema = z.object({
  body: z.strictObject({
    message: z.object({
      domain: z.string(),
      address: z.string(),
      statement: z.string(),
      uri: z.string(),
      version: z.string(),
      chainId: z.number(),
      nonce: z.string().uuid(),
    }),
    signature: z.string().regex(/^0x([a-fA-F0-9]{130})$/),
    address: z.string().regex(/(0x)?[0-9a-fA-F]{40}/),
  }),
});

export const editUserSchema = z.object({
  body: z.strictObject({
    pfp: z.string().url(),
    username: z.string(),
    email: z.string().email(),
  }),
});

export const verifyKYC = z.object({
  body: z.strictObject({
    otp: z.string().length(6),
  }),
});

export type SIWE = z.TypeOf<typeof SIWESchema>;
export type EditUser = z.TypeOf<typeof editUserSchema>;
export type VerifyKYC = z.TypeOf<typeof verifyKYC>;
