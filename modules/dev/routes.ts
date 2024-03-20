import express, { Request, Response } from "express";
import validate from "../../shared/middlewares/validateSchema";
import {
  ChangeDevPassword,
  DevSudoMode,
  EditDev,
  ForgotDevPassword,
  LoginDev,
  OnboardUser,
  RegisterDev,
  ResetDevPassword,
  VerifyDevOTP,
  VerifyResetDevPassword,
  changeDevPasswordSchema,
  devSudoModeSchema,
  editDevSchema,
  forgotDevPasswordSchema,
  loginDevSchema,
  onboardUserSchema,
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
  dateUTC,
  generateHash,
  generateOTP,
  hashPassword,
  setCookie,
} from "../../shared/utils/helpers";
import { sendDevForgotPasswordMail, sendDevKYCMail } from "../../shared/utils/mailer";
import config from "../../shared/utils/config";
import { createSession } from "../session/service";
import { signJWT } from "../../shared/utils/jwt";
import { omit } from "lodash";
import oauthRoutes from "./oauth.routes";

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
          message: "Email address already in use by another account",
        });
      }

      const otp = generateOTP();
      const password = await hashPassword(req.body.password);
      const resp = await createDev({
        ...req.body,
        emailVerificationOTP: otp,
        emailVerificationOTPExpiry: dateUTC(
          dateUTC().getTime() + parseInt(config.KYC_OTP_TTL)
        ),
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

      // set cookie
      setCookie(res, "accessToken", accessToken, 5 * 60 * 1000); // 5 minutes
      setCookie(res, "refreshToken", refreshToken, 365 * 24 * 60 * 60 * 1000); // 1yr

      return res.status(201).json({
        status: true,
        message: "Account registered successfully",
        data: {
          data: omit(resp.toJSON(), [
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

router.use("/oauth", oauthRoutes);

router.put(
  "/onboard",
  canAccessRoute(QUYX_USER.DEV),
  validate(onboardUserSchema),
  async function (req: Request<{}, {}, OnboardUser["body"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      await updateDev({ _id: identifier }, req.body);
      return res.status(201).json({
        status: true,
        message: "Onboarding completed!",
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
          message: "Invalid email address",
        });
      }

      const isPasswordCorrect = await comparePasswords(password, dev.password);
      if (!isPasswordCorrect) {
        return res.json({
          status: false,
          message: "Invalid password combination",
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

      // set cookie
      setCookie(res, "accessToken", accessToken, 5 * 60 * 1000); // 5 minutes
      setCookie(res, "refreshToken", refreshToken, 365 * 24 * 60 * 60 * 1000); // 1yr

      return res.status(201).json({
        status: true,
        message: "Account logged in successfully",
        data: {
          data: omit(dev.toJSON(), [
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
        message: "Fetched dev",
        data: omit(dev.toJSON(), [
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
  async function (req: Request<{}, {}, VerifyDevOTP["body"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { otp } = req.body;

      const dev = await findDev({ _id: identifier });
      if (dev!.emailVerificationOTP !== otp) {
        return res.status(409).json({
          status: false,
          message: "Wrong OTP code provided",
        });
      }

      if (
        !dev!.emailVerificationOTPExpiry ||
        dateUTC().getTime() > dateUTC(dev!.emailVerificationOTPExpiry).getTime()
      ) {
        return res.status(400).json({
          status: false,
          message: "OTP code has expired, request a new one",
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
        message: "Email verified successfully!",
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
          message: "Email address has already been verified",
        });
      }

      await updateDev(
        { _id: identifier },
        {
          emailVerificationOTP: otp,
          emailVerificationOTPExpiry: dateUTC(
            dateUTC().getTime() + parseInt(config.KYC_OTP_TTL)
          ),
        }
      );

      await sendDevKYCMail({
        email: dev!.email,
        otp,
        firstName: dev!.firstName,
      });

      return res.status(201).json({
        status: true,
        message: `OTP sent to ${dev!.email}`,
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
  async function (req: Request<{}, {}, DevSudoMode["body"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { password } = req.body;

      const dev = await findDev({ _id: identifier });
      const isPasswordCorrect = await comparePasswords(password, dev!.password);
      if (!isPasswordCorrect) {
        return res.status(409).json({
          status: false,
          message: "Wrong password",
        });
      }

      await updateDev({ _id: identifier }, { verifiedPasswordLastOn: dateUTC() });
      return res.json({
        status: true,
        message: "Sudo mode initated",
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
        dateUTC(dev!.verifiedPasswordLastOn).getTime() + parseInt(config.SUDO_TTL) <
          dateUTC().getTime()
      ) {
        return res.status(401).json({
          status: false,
          message: "Enter sudo mode to complete request",
        });
      }

      const resp = await updateDev({ _id: identifier }, req.body);
      if (!resp) return res.sendStatus(409);

      return res.status(201).json({
        status: true,
        message: "Profile updated successfully!",
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
          message: "Old password is not correct",
        });
      }

      const password = await hashPassword(newPassword);
      updateDev({ _id: identifier }, { password });

      return res.status(201).json({
        status: true,
        message: "Password changed successfully!",
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
          forgetPasswordHashExpiry: dateUTC(dateUTC().getTime() + parseInt(config.HASH_TTL)),
        }
      );

      await sendDevForgotPasswordMail({
        email: dev!.email,
        hash,
        firstName: dev!.firstName,
      });

      return res.status(201).json({
        status: true,
        message: `Password reset mail sent to ${dev!.email}`,
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

      if (
        !dev.forgetPasswordHashExpiry ||
        dateUTC().getTime() > dateUTC(dev.forgetPasswordHashExpiry).getTime()
      ) {
        return res.status(400).json({
          status: false,
          message: "Link has expired, request a new one",
        });
      }

      return res.json({
        status: true,
        message: "Hash is valid",
        data: omit(dev.toJSON(), [
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

      if (
        !dev.forgetPasswordHashExpiry ||
        dateUTC().getTime() > dateUTC(dev.forgetPasswordHashExpiry).getTime()
      ) {
        return res.status(400).json({
          status: false,
          message: "Link has expired, request a new one",
        });
      }

      const hashedPassword = await hashPassword(password);
      await updateDev({ _id: dev._id }, { password: hashedPassword });

      return res.status(201).json({
        status: true,
        message: "Password changed successfully! proceed to login",
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
