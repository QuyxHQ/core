import express, { Request, Response } from "express";
import validate from "../../shared/middlewares/validateSchema";
import {
  ChangeDevPassword,
  DevSudoMode,
  EditDev,
  ForgotDevPassword,
  LoginDev,
  RegisterDev,
  ResetDevPassword,
  VerifyDevOTP,
  VerifyResetDevPassword,
  changeDevPasswordSchema,
  devSudoModeSchema,
  editDevSchema,
  forgotDevPasswordSchema,
  loginDevSchema,
  registerDevSchema,
  resetDevPasswordSchema,
  verifyDevOTPSchema,
  verifyResetDevPasswordSchema,
} from "./schema";
import { countDevs, createDev, findDev, updateDev } from "./service";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import {
  comparePasswords,
  generateHash,
  generateOTP,
  hashPassword,
} from "../../shared/utils/helpers";
import { sendDevForgotPasswordMail, sendDevKYCMail } from "../../shared/utils/mailer";
import config from "../../shared/utils/config";
import { createSession } from "../session/service";
import { signJWT } from "../../shared/utils/jwt";
import { omit } from "lodash";

const router = express.Router();

//# register dev
router.post(
  "/",
  validate(registerDevSchema),
  async function (req: Request<{}, {}, RegisterDev["body"]>, res: Response) {
    try {
      const sameEmailCount = await countDevs({ email: req.body.email });
      if (sameEmailCount > 0) {
        return res.status(409).json({
          status: false,
          message: "email address already in use by another account",
        });
      }

      const otp = generateOTP();
      const password = await hashPassword(req.body.password);
      const resp = await createDev({
        ...req.body,
        emailVerificationOTP: otp,
        emailVerificationOTPExpiry: new Date(Date.now() + parseInt(config.KYC_OTP_TTL)),
        password,
      });

      await sendDevKYCMail({
        email: resp.email,
        otp,
        firstName: resp.firstName,
      });

      //# Creating a session
      const session = await createSession(resp._id, QUYX_USER.DEV, req.get("user-agent"));

      //# creating the payload
      const payload = {
        session: session._id,
        role: QUYX_USER.DEV,
        identifier: resp._id,
      };

      const accessToken = signJWT(payload, { expiresIn: config.ACCESS_TOKEN_TTL });
      const refreshToken = signJWT(payload, { expiresIn: config.REFRESH_TOKEN_TTL });

      return res.status(201).json({
        status: true,
        message: "account registered successfully",
        data: {
          data: omit(resp, [
            "emailVerificationOTP",
            "emailVerificationOTPExpiry",
            "forgetPasswordHash",
            "forgetPasswordHashExpiry",
            "password",
          ]),
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# log dev in
router.post(
  "/login",
  validate(loginDevSchema),
  async function (req: Request<{}, {}, LoginDev["body"]>, res: Response) {
    try {
      const { email, password } = req.body;

      const dev = await findDev({ email });
      if (!dev) {
        return res.json({
          status: false,
          message: "invalid email address",
        });
      }

      const isPasswordCorrect = await comparePasswords(password, dev.password);
      if (!isPasswordCorrect) {
        return res.json({
          status: false,
          message: "invalid password combination",
        });
      }

      //# Creating a session
      const session = await createSession(dev._id, QUYX_USER.DEV, req.get("user-agent"));

      //# creating the payload
      const payload = {
        session: session._id,
        role: QUYX_USER.DEV,
        identifier: dev._id,
      };

      const accessToken = signJWT(payload, { expiresIn: config.ACCESS_TOKEN_TTL });
      const refreshToken = signJWT(payload, { expiresIn: config.REFRESH_TOKEN_TTL });

      return res.status(201).json({
        status: true,
        message: "account logged in successfully",
        data: {
          data: omit(dev, [
            "emailVerificationOTP",
            "emailVerificationOTPExpiry",
            "forgetPasswordHash",
            "forgetPasswordHashExpiry",
            "password",
          ]),
          tokens: {
            accessToken,
            refreshToken,
          },
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# get current logged in dev
router.get(
  "/current",
  canAccessRoute(QUYX_USER.DEV),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      const dev = await findDev({ _id: identifier });
      if (!dev) return res.sendStatus(404);

      return res.json({
        status: true,
        message: "fetched dev",
        data: omit(dev, [
          "emailVerificationOTP",
          "emailVerificationOTPExpiry",
          "forgetPasswordHash",
          "forgetPasswordHashExpiry",
          "password",
        ]),
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# verify KYC otp
router.put(
  "/verify-otp",
  canAccessRoute(QUYX_USER.DEV),
  validate(verifyDevOTPSchema),
  async function (
    req: Request<{}, {}, VerifyDevOTP["body"]>,
    res: Response<{}, QuyxLocals>
  ) {
    try {
      const { identifier } = res.locals.meta;
      const { otp } = req.body;

      const dev = await findDev({ _id: identifier });
      if (new Date().getTime() > new Date(dev!.emailVerificationOTPExpiry!).getTime()) {
        return res.status(400).json({
          status: false,
          message: "OTP code has expired, request a new one",
        });
      }

      if (dev!.emailVerificationOTP !== otp) {
        return res.status(409).json({
          status: false,
          message: "Wrong OTP code provided",
        });
      }

      await updateDev(
        { _id: identifier },
        {
          isEmailVerified: true,
          emailVerificationOTP: null,
          emailVerificationOTPExpiry: null,
        }
      );

      return res.json({
        status: true,
        message: "email verified successfully!",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# resenf KYC otp
router.put(
  "/resend-otp",
  canAccessRoute(QUYX_USER.DEV),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const otp = generateOTP();

      const dev = await findDev({ _id: identifier });
      if (dev!.isEmailVerified) {
        return res.status(409).json({
          status: false,
          message: "email address has already been verified",
        });
      }

      await updateDev(
        { _id: identifier },
        {
          emailVerificationOTP: otp,
          emailVerificationOTPExpiry: new Date(Date.now() + parseInt(config.KYC_OTP_TTL)),
        }
      );

      await sendDevKYCMail({
        email: dev!.email,
        otp,
        firstName: dev!.firstName,
      });

      return res.status(201).json({
        status: true,
        message: `otp sent to ${dev!.email}`,
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# enter SUDO mode
router.post(
  "/sudo",
  canAccessRoute(QUYX_USER.DEV),
  validate(devSudoModeSchema),
  async function (
    req: Request<{}, {}, DevSudoMode["body"]>,
    res: Response<{}, QuyxLocals>
  ) {
    try {
      const { identifier } = res.locals.meta;
      const { password } = req.body;

      const dev = await findDev({ _id: identifier });
      const isPasswordCorrect = await comparePasswords(password, dev!.password);
      if (!isPasswordCorrect) {
        return res.status(409).json({
          status: false,
          message: "wrong password",
        });
      }

      await updateDev({ _id: identifier }, { verifiedPasswordLastOn: new Date() });
      return res.json({
        status: true,
        message: "sudo mode entered",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# edit dev profile
router.put(
  "/edit",
  canAccessRoute(QUYX_USER.DEV),
  validate(editDevSchema),
  async function (req: Request<{}, {}, EditDev["body"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      const dev = await findDev({ _id: identifier });
      //# check if still in sudo mode
      if (
        !dev!.verifiedPasswordLastOn ||
        new Date(dev!.verifiedPasswordLastOn).getTime() + parseInt(config.SUDO_TTL) <
          Date.now()
      ) {
        return res.status(401).json({
          status: false,
          message: "enter sudo mode to complete request",
        });
      }

      const resp = await updateDev({ _id: identifier }, req.body);
      if (!resp) return res.sendStatus(409);

      return res.status(201).json({
        status: true,
        message: "profile updated successfully!",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# change password
router.put(
  "/change-password",
  canAccessRoute(QUYX_USER.DEV),
  validate(changeDevPasswordSchema),
  async function (
    req: Request<{}, {}, ChangeDevPassword["body"]>,
    res: Response<{}, QuyxLocals>
  ) {
    try {
      const { identifier } = res.locals.meta;
      const { newPassword, oldPassword } = req.body;

      const dev = await findDev({ _id: identifier });
      const isPasswordCorrect = await comparePasswords(oldPassword, dev!.password);
      if (!isPasswordCorrect) {
        return res.status(409).json({
          status: false,
          message: "old password is not correct",
        });
      }

      const password = await hashPassword(newPassword);
      updateDev({ _id: identifier }, { password });

      return res.status(201).json({
        status: true,
        message: "password changed successfully!",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# forgot password route
router.put(
  "/forgot-password/:email",
  validate(forgotDevPasswordSchema),
  async function (req: Request<ForgotDevPassword["params"]>, res: Response) {
    try {
      const { email } = req.params;

      const dev = await findDev({ email });
      if (!dev) return res.sendStatus(404);

      const hash = generateHash();

      await updateDev(
        { email },
        {
          forgetPasswordHash: hash,
          forgetPasswordHashExpiry: new Date(Date.now() + parseInt(config.HASH_TTL)),
        }
      );

      await sendDevForgotPasswordMail({
        email: dev!.email,
        hash,
        firstName: dev!.firstName,
      });

      return res.status(201).json({
        status: true,
        message: `password reset mail sent to ${dev!.email}`,
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# verify reset password hash
router.get(
  "/verify/reset-password/:hash",
  validate(verifyResetDevPasswordSchema),
  async function (req: Request<VerifyResetDevPassword["params"]>, res: Response) {
    try {
      const { hash } = req.params;

      const dev = await findDev({ forgetPasswordHash: hash });
      if (!dev) return res.sendStatus(404);

      if (new Date().getTime() > new Date(dev.forgetPasswordHashExpiry!).getTime()) {
        return res.status(400).json({
          status: false,
          message: "link has expired, request a new one",
        });
      }

      return res.json({
        status: true,
        message: "hash is valid",
        data: omit(dev, [
          "emailVerificationOTP",
          "emailVerificationOTPExpiry",
          "forgetPasswordHash",
          "forgetPasswordHashExpiry",
          "password",
        ]),
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# reset password
router.put(
  "/reset-password/:hash",
  validate(resetDevPasswordSchema),
  async function (
    req: Request<ResetDevPassword["params"], {}, ResetDevPassword["body"]>,
    res: Response
  ) {
    try {
      const { hash } = req.params;
      const { password } = req.body;

      const dev = await findDev({ forgetPasswordHash: hash });
      if (!dev) return res.sendStatus(404);

      if (new Date().getTime() > new Date(dev.forgetPasswordHashExpiry!).getTime()) {
        return res.status(400).json({
          status: false,
          message: "link has expired, request a new one",
        });
      }

      const hashedPassword = await hashPassword(password);
      await updateDev({ _id: dev._id }, { password: hashedPassword });

      return res.status(201).json({
        status: true,
        message: "password changed successfully!",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

export = router;
