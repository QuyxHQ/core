import express, { Request, Response } from "express";
import validate from "../../shared/middlewares/validateSchema";
import { EditUser, SIWE, SIWESchema, VerifyKYC, editUserSchema, verifyKYC } from "./schema";
import { SiweMessage } from "siwe";
import { countUsers, findUser, findUsers, updateUser, upsertUser } from "./service";
import { generateUsername } from "unique-username-generator";
import { signJWT } from "../../shared/utils/jwt";
import { QUYX_USER } from "../../shared/utils/constants";
import { createSession } from "../session/service";
import config from "../../shared/utils/config";
import { canAccessRoute } from "../../shared/utils/validators";
import { omit } from "lodash";
import { dateUTC, generateOTP, generateUsernameSuggestion } from "../../shared/utils/helpers";
import { sendKYCMail } from "../../shared/utils/mailer";
import { deleteNonce, findNonce } from "../nonce/service";

const router = express.Router();

//# Logging in with SIWE
router.post(
  "/siwe",
  validate(SIWESchema),
  async function (req: Request<{}, {}, SIWE["body"]>, res: Response) {
    try {
      const { message, signature } = req.body;

      const nonce = await findNonce({ nonce: message.nonce });
      if (!nonce) {
        return res.status(422).json({
          status: false,
          message: "invalid nonce set",
        });
      }

      if (dateUTC(nonce.expirationTime).getTime() < dateUTC().getTime()) {
        return res.status(400).json({
          status: false,
          message: "nonce is expired! request a new one",
        });
      }

      if (message.nonce != nonce.nonce) {
        await deleteNonce({ _id: nonce._id });

        return res.status(422).json({
          status: false,
          message: "invalid nonce set",
        });
      }

      //# immediately trash away the nonce
      await deleteNonce({ _id: nonce._id });

      const messageSIWE = new SiweMessage(message);
      const resp = await messageSIWE.verify({
        signature,
        domain: message.domain,
        nonce: message.nonce,
      });

      if (!resp.success) {
        return res.status(400).json({
          status: false,
          message: resp.error?.type,
          data: {
            expected: resp.error?.expected,
            received: resp.error?.received,
          },
        });
      }

      //# Continue with logging in or registering user
      const { address } = resp.data;
      const username = generateUsername("", 3);

      const user = await upsertUser(address, {
        address,
        username,
      });

      //# Creating a session
      const session = await createSession(user._id, QUYX_USER.USER, req.get("user-agent"));

      //# creating the payload
      const payload = {
        session: session._id,
        role: QUYX_USER.USER,
        identifier: user._id,
      };

      const accessToken = signJWT(payload, { expiresIn: config.ACCESS_TOKEN_TTL });
      const refreshToken = signJWT(payload, { expiresIn: config.REFRESH_TOKEN_TTL });

      return res.status(201).json({
        status: true,
        message: "logged in successfully!",
        data: {
          accessToken,
          refreshToken,
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

//# Get the details of the current logged in user
router.get(
  "/current",
  canAccessRoute(QUYX_USER.USER),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      const user = await findUser({ _id: identifier });
      if (!user) return res.sendStatus(404);

      return res.json({
        status: true,
        message: "Fetched",
        data: omit(user.toJSON(), ["emailVerificationCode", "emailVerificationCodeExpiry"]),
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# Edit user info
router.put(
  "/edit",
  canAccessRoute(QUYX_USER.USER),
  validate(editUserSchema),
  async function (req: Request<{}, {}, EditUser["body"]>, res: Response<{}, QuyxLocals>) {
    try {
      const _id = res.locals.meta.identifier;
      const user = await findUser({ _id });

      const { username, pfp, email } = req.body;

      //# username exist
      if (user!.username != username) {
        const doesUsernameExist = await findUser({ username });
        if (doesUsernameExist) {
          return res.status(409).json({
            status: false,
            message: "username is already taken, try a new one",
            data: {
              suggestions: generateUsernameSuggestion(username),
            },
          });
        }
      }

      //# email address exist
      if (user!.email != email) {
        const doesEmailExist = await findUser({ email });
        if (doesEmailExist) {
          return res.status(409).json({
            status: false,
            message: "email address already exist on another account",
          });
        }
      }

      const resp = await updateUser(
        { _id },
        {
          username,
          email,
          pfp,
          ...(username != user!.username
            ? { changedUsernameLastOn: dateUTC(), hasBlueTick: false }
            : {}),
        }
      );
      if (!resp) return res.sendStatus(400);

      return res.status(201).json({
        status: true,
        message: "info updated",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# Initialize user KYC
router.post(
  "/kyc/init",
  canAccessRoute(QUYX_USER.USER),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const user = await findUser({ _id: identifier });

      if (!user!.email) {
        return res.status(200).json({
          status: false,
          message: "email address must be set before performing KYC",
        });
      }

      if (user!.hasCompletedKYC) {
        return res.status(200).json({
          status: false,
          message: "KYC has been done already",
        });
      }

      const otp = generateOTP();
      const resp = await updateUser(
        { _id: identifier },
        {
          emailVerificationCode: otp,
          emailVerificationCodeExpiry: dateUTC(
            dateUTC().getTime() + parseInt(config.KYC_OTP_TTL)
          ),
        }
      );

      if (!resp) return res.sendStatus(400);

      await sendKYCMail({
        email: user!.email,
        otp,
        username: user!.username,
      });

      return res.status(201).json({
        status: true,
        message: `OTP sent to ${user!.email}`,
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# Verifying user for KYC
router.post(
  "/kyc/verify",
  canAccessRoute(QUYX_USER.USER),
  validate(verifyKYC),
  async function (req: Request<{}, {}, VerifyKYC["body"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const user = await findUser({ _id: identifier });

      const { otp } = req.body;

      if (otp !== user!.emailVerificationCode!) {
        return res.status(400).json({
          status: false,
          message: "Invalid OTP code provided",
        });
      }

      if (
        !user!.emailVerificationCodeExpiry ||
        dateUTC().getTime() > dateUTC(user!.emailVerificationCodeExpiry).getTime()
      ) {
        return res.status(400).json({
          status: false,
          message: "OTP code has expired, request a new one",
        });
      }

      await updateUser(
        { _id: identifier },
        {
          emailVerificationCode: null,
          emailVerificationCodeExpiry: null,
        }
      );

      return res.status(201).json({
        status: true,
        message: "KYC completed",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# Get a single user (username or address)
router.get("/:param", async function (req: Request, res: Response) {
  try {
    const { param } = req.params as { param: string };
    if (typeof param != "string") return res.sendStatus(400);

    const user = await findUser({ $or: [{ address: param }, { username: param }] });
    if (!user) return res.sendStatus(404);

    return res.json({
      status: true,
      message: "fetched user",
      data: user,
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

//# search by username
router.get("/search", async function (req: Request, res: Response) {
  try {
    const { q, limit = "10", page = "1" } = req.query as any;
    if (typeof q != "string") return res.sendStatus(400);
    if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

    const totalResults = await countUsers({ username: { $regex: q, $options: "i" } });
    const result = await findUsers(
      { username: { $regex: q, $options: "i" } },
      { limit: parseInt(limit), page: parseInt(page) }
    );

    return res.json({
      status: true,
      message: "fetched users",
      data: result,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        skip: (parseInt(page) - 1) * parseInt(limit),
        total: totalResults,
      },
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

export = router;
