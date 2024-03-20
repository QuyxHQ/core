import { z } from "zod";

export const verifyQuyxJWTSchema = z.object({
  body: z.object({ token: z.string() }),
});

export type VerifyQuyxJWT = z.TypeOf<typeof verifyQuyxJWTSchema>;
