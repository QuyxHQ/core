import { z } from "zod";

export const registerDevSchema = z.object({
  body: z.object({
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    company: z.string().nullable(),
    role: z.string(),
    heardUsFrom: z.string(),
    password: z.string(),
  }),
});

export const loginDevSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string(),
  }),
});

export const editDevSchema = z.object({
  body: z.object({
    email: z.string().email(),
    firstName: z.string(),
    lastName: z.string(),
    company: z.string().nullable(),
    role: z.string(),
  }),
});

export const changeDevPasswordSchema = z.object({
  body: z.object({
    oldPassword: z.string(),
    newPassword: z.string(),
  }),
});

export const verifyDevOTPSchema = z.object({
  body: z.object({
    otp: z.string().length(6),
  }),
});

export const devSudoModeSchema = z.object({
  body: z.object({
    password: z.string(),
  }),
});

export const forgotDevPasswordSchema = z.object({
  params: z.object({
    email: z.string().email(),
  }),
});

export const verifyResetDevPasswordSchema = z.object({
  params: z.object({
    hash: z.string(),
  }),
});

export const resetDevPasswordSchema = z.object({
  params: z.object({
    hash: z.string(),
  }),
  body: z.object({
    password: z.string(),
  }),
});

export type RegisterDev = z.TypeOf<typeof registerDevSchema>;
export type LoginDev = z.TypeOf<typeof loginDevSchema>;
export type EditDev = z.TypeOf<typeof editDevSchema>;
export type ChangeDevPassword = z.TypeOf<typeof changeDevPasswordSchema>;
export type VerifyDevOTP = z.TypeOf<typeof verifyDevOTPSchema>;
export type DevSudoMode = z.TypeOf<typeof devSudoModeSchema>;
export type ForgotDevPassword = z.TypeOf<typeof forgotDevPasswordSchema>;
export type VerifyResetDevPassword = z.TypeOf<typeof verifyResetDevPasswordSchema>;
export type ResetDevPassword = z.TypeOf<typeof resetDevPasswordSchema>;
