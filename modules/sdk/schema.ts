import { z } from "zod";

export const changeCardSDKSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export const getSDKUsersSchema = z.object({
  params: z.object({
    app: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export type ChangeCardSDK = z.TypeOf<typeof changeCardSDKSchema>;
export type GetSDKUsers = z.TypeOf<typeof getSDKUsersSchema>;
