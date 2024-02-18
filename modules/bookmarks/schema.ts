import { z } from "zod";

export const addToBookmarkSchema = z.object({
  body: z.object({
    cardId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export const removeFromBookmarkSchema = z.object({
  params: z.object({
    cardId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export type AddToBookmark = z.TypeOf<typeof addToBookmarkSchema>;
export type RemoveFromBookmark = z.TypeOf<typeof removeFromBookmarkSchema>;
