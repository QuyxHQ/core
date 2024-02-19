import { z } from "zod";

export const registerAppSchema = z.object({
  body: z.strictObject({
    name: z.string(),
    description: z.string(),
    allowedDomains: z.string().url().array().nullable(),
    allowedBundleIDs: z.string().array().nullable(),
    blacklistedAddresses: z.string().array().nullable(),
    whitelistedAddresses: z.string().array().nullable(),
  }),
});

export const deleteAppSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export const getAppSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export const editAppSchema = z.object({
  body: z.strictObject({
    name: z.string(),
    description: z.string(),
    allowedDomains: z.string().url().array().nullable(),
    allowedBundleIDs: z.string().array().nullable(),
    whitelistedAddress: z.string().array().nullable(),
    blacklistedAddress: z.string().array().nullable(),
  }),
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/),
  }),
});

export type RegisterApp = z.TypeOf<typeof registerAppSchema>;
export type DeleteApp = z.TypeOf<typeof deleteAppSchema>;
export type GetApp = z.TypeOf<typeof getAppSchema>;
export type EditApp = z.TypeOf<typeof editAppSchema>;
