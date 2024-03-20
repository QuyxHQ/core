import express, { Request, Response } from "express";
import { QuyxSIWS } from "@quyx/siws";
import validate from "../../shared/middlewares/validateSchema";
import {
  CheckForDuplicateUsername,
  EditUser,
  SIWS,
  SIWSSchema,
  SearchUser,
  VerifyKYC,
  checkForDuplicateUsername,
  editUserSchema,
  searchUserSchema,
  verifyKYC,
} from "./schema";
import { countUsers, findUser, findUsers, updateUser, upsertUser } from "./service";
import { generateUsername } from "unique-username-generator";
import { signJWT } from "../../shared/utils/jwt";
import { QUYX_LOG_STATUS, QUYX_USER } from "../../shared/utils/constants";
import { createSession } from "../session/service";
import config from "../../shared/utils/config";
import { canAccessRoute } from "../../shared/utils/validators";
import { omit } from "lodash";
import {
  dateUTC,
  generateOTP,
  generateUsernameSuggestion,
  getCacheKey,
  setCookie,
} from "../../shared/utils/helpers";
import { sendKYCMail } from "../../shared/utils/mailer";
import { countSDKUsers, deleteSDKUser, getAppsUserIsConnectedTo } from "../sdk/service";
import { findCard } from "../card/service";
import { sendWebhook } from "../../shared/utils/webhook-sender";

const router = express.Router();

//# check for duplicate username
router.get(
  "/check-for-duplicate-username",
  validate(checkForDuplicateUsername),
  async function (
    req: Request<{}, {}, {}, CheckForDuplicateUsername["query"]>,
    res: Response
  ) {
    try {
      const { username } = req.query;

      const usernameOccurance = await countUsers({ username, isDeleted: false });
      if (usernameOccurance == 0) {
        return res.status(200).json({
          status: true,
          message: "Username not taken",
        });
      }

      return res.status(409).json({
        status: false,
        message: "Username is already taken, try a new one",
        data: generateUsernameSuggestion(username),
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# Logging in
router.post(
  "/siws",
  validate(SIWSSchema),
  async function (req: Request<{}, {}, SIWS["body"] & { output: any }>, res: Response) {
    try {
      const { message, signature } = req.body;

      const key = getCacheKey(req, message.address);
      const cachedNonceData = config.cache.get(key) as CachedData | undefined;
      if (!cachedNonceData) {
        //# expired nonce
        return res
          .status(422)
          .json({ status: false, message: "Nonce has expired! Request a new one" });
      }

      //# invalid nonce
      if (cachedNonceData.nonce !== message.nonce) {
        return res.status(422).json({ status: false, message: "Invalid nonce set" });
      }

      //# immediately trash away the nonce
      config.cache.del(key);

      //# verify stuffs >>>>>
      const signinMessage = new QuyxSIWS(message);
      const isSignerValid = signinMessage.validate(signature);
      if (!isSignerValid) {
        return res
          .status(409)
          .json({ status: false, message: "Sign In verification failed!" });
      }

      //# Continue with logging in or registering user
      const { address } = message;
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

      // set cookie
      setCookie(res, "accessToken", accessToken, 5 * 60 * 1000); // 5 minutes
      setCookie(res, "refreshToken", refreshToken, 365 * 24 * 60 * 60 * 1000); // 1yr

      return res.status(201).json({
        status: true,
        message: "Logged in successfully!",
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
        data: omit(user.toJSON(), [
          "emailVerificationCode",
          "emailVerificationCodeExpiry",
          "boughtCards",
          "soldCards",
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
            message: "Username is already taken, try a new one",
          });
        }
      }

      //# email address exist
      if (user!.email != email) {
        const doesEmailExist = await findUser({ email });
        if (doesEmailExist) {
          return res.status(409).json({
            status: false,
            message: "Email address already exist on another account",
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
        message: "Info updated successfully!",
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
          message: "Email address must be set before performing KYC",
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
          hasCompletedKYC: true,
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
router.get("/single/:param", async function (req: Request, res: Response) {
  try {
    const { param } = req.params as { param: string };
    if (typeof param != "string") return res.sendStatus(400);

    const user = await findUser({ $or: [{ address: param }, { username: param }] });
    if (!user) return res.sendStatus(404);

    return res.json({
      status: true,
      message: "Fetched user",
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
router.get(
  "/search",
  validate(searchUserSchema),
  async function (req: Request<{}, {}, {}, SearchUser["query"]>, res: Response) {
    try {
      const { q, limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const filter = { username: { $regex: q, $options: "i" } };
      const totalResults = await countUsers(filter);
      const result = await findUsers(filter, { limit: parseInt(limit), page: parseInt(page) });

      return res.json({
        status: true,
        message: "Fetched users",
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
  }
);

//# route to get all apps they've apps to
router.get(
  "/apps-connected",
  canAccessRoute(QUYX_USER.USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const user = await findUser({ _id: identifier });
      const totalResults = await countSDKUsers({ address: user?.address });
      const result = await getAppsUserIsConnectedTo(user?.address!, {
        limit: parseInt(limit),
        page: parseInt(page),
      });

      return res.json({
        status: true,
        message: "Fetched apps",
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
  }
);

//# disconnecting apps from Quyx dashboard
router.delete(
  "/disconnect/:appId/:cardId",
  canAccessRoute(QUYX_USER.USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { cardId, appId } = req.params;
      if (typeof cardId != "string" || typeof appId != "string") return res.sendStatus(400);

      const { identifier } = res.locals.meta;

      const card = await findCard({ identifier: cardId });
      if (!card) return res.sendStatus(404);
      if (String(card.owner) !== identifier) return res.sendStatus(409);

      await deleteSDKUser({ app: appId, card: cardId });
      await sendWebhook(card.toJSON(), "event.card_disconnected");

      return res.status(201).json({
        status: true,
        message: "Card disconnected successfully",
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
