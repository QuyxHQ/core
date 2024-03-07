import { z } from "zod";

export const addToBookmarkSchema = z.object({
  body: z.strictObject({
    card: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export const removeFromBookmarkSchema = z.object({
  params: z.object({
    card: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export const getBookmarkSchema = z.object({
  params: z.object({
    card: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export type AddToBookmark = z.TypeOf<typeof addToBookmarkSchema>;
export type RemoveFromBookmark = z.TypeOf<typeof removeFromBookmarkSchema>;
export type GetBookmark = z.TypeOf<typeof getBookmarkSchema>;
