import { z } from "zod";

export const createCardSchema = z.object({
  body: z.object({
    identifier: z.undefined(),
    chainId: z.enum(["1", "56"]),
    username: z.string(),
    pfp: z.string().url(),
    bio: z.string(),
    description: z.string().nullable(),
    isAuction: z.boolean().nullable(),
    maxNumberOfBids: z.number().nullable(),
    aunctionEnds: z.date().nullable(),
    tags: z.string().array().nullable(),
  }),
});

export const editCardSchema = z.object({
  params: z.object({
    chainId: z.enum(["1", "56"]),
    cardId: z.string(),
  }),
  body: z.object({
    username: z.string(),
    pfp: z.string().url(),
    bio: z.string(),
    description: z.string().nullable(),
    tags: z.string().array().nullable(),
  }),
});

export const getUserCardSchema = z.object({
  params: z.object({
    chainId: z.enum(["1", "56"]),
    address: z.string().regex(/(0x)?[0-9a-fA-F]{40}/),
  }),
});

export type CreateCard = z.TypeOf<typeof createCardSchema>;
export type EditCard = z.TypeOf<typeof editCardSchema>;
export type GetUserCard = z.TypeOf<typeof getUserCardSchema>;
