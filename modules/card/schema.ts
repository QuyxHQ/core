import { z } from "zod";

export const checkForDuplicateCardUsername = z.object({
  query: z.object({
    username: z.string(),
  }),
});

export const createCardSchema = z.object({
  body: z.strictObject({
    username: z.string(),
    pfp: z.string().url(),
    bio: z.string(),
    description: z.string().nullable(),
    tags: z.string().array().nullable(),
  }),
});

export const editCardSchema = z.object({
  params: z.object({ cardId: z.string() }),
  body: z.strictObject({
    username: z.string(),
    pfp: z.string().url(),
    bio: z.string(),
    description: z.string().nullable(),
    tags: z.string().array().nullable(),
  }),
});

export const getUserCardSchema = z.object({
  params: z.object({ address: z.string() }),
});

export type CheckForDuplicateCardUsername = z.TypeOf<typeof checkForDuplicateCardUsername>;
export type CreateCard = z.TypeOf<typeof createCardSchema>;
export type EditCard = z.TypeOf<typeof editCardSchema>;
export type GetUserCard = z.TypeOf<typeof getUserCardSchema>;
