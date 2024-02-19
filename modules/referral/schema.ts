import { z } from "zod";

export const createReferrallLinkSchema = z.object({
  body: z.object({
    card: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export const incrementReferralClickSchema = z.object({
  params: z.object({
    ref: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export const getReferralSchema = z.object({
  params: z.object({
    ref: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export type CreateReferralLink = z.TypeOf<typeof createReferrallLinkSchema>;
export type IncrementReferralClick = z.TypeOf<typeof incrementReferralClickSchema>;
export type GetReferral = z.TypeOf<typeof getReferralSchema>;
