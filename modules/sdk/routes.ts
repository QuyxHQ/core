import express, { Request, Response } from "express";
import { QuyxSIWS } from "@quyx/siws";
import bs58 from "bs58";
import { canAccessRoute, hasAccessToSDK } from "../../shared/utils/validators";
import { QUYX_LOG_STATUS, QUYX_USER } from "../../shared/utils/constants";
import { addLog } from "../log/service";
import { SIWS, SIWSSchema } from "../user/schema";
import validate from "../../shared/middlewares/validateSchema";
import {
  countSDKUsers,
  deleteSDKUser,
  findSDKUser,
  findSDKUsers,
  updateSDKUser,
  upsertSDKUser,
} from "./service";
import { createSession } from "../session/service";
import config from "../../shared/utils/config";
import { signJWT } from "../../shared/utils/jwt";
import { countCards, findCard, findCards } from "../card/service";
import { findUser } from "../user/service";
import { ChangeCardSDK, changeCardSDKSchema } from "./schema";
import { dateUTC, getCacheKey, isValidAddress } from "../../shared/utils/helpers";

const router = express.Router();

//# helper lgo fn
type WriteLogProps = {
  start: number;
  status: QUYX_LOG_STATUS;
  message?: string;
};

async function writeLog(
  { start, status, message }: WriteLogProps,
  app: QuyxApp & { _id: string },
  req: Request
) {
  await addLog({
    app: app._id,
    dev: app.owner,
    status,
    route: req.url,
    log:
      status === QUYX_LOG_STATUS.FAILED
        ? JSON.stringify({
            body: req.body,
            params: req.params,
            query: req.query,
            message,
          })
        : null,
    responseTime: dateUTC().getTime() - start,
    date: dateUTC(),
  });
}

//# logging in a SDK user
router.post(
  "/login",
  validate(SIWSSchema),
  hasAccessToSDK(),
  async function (
    req: Request<{}, {}, SIWS["body"] & { output: any }>,
    res: Response<{}, QuyxLocals>
  ) {
    const { app } = res.locals;
    const start = dateUTC().getTime();

    try {
      const { signature, message } = req.body;

      const key = getCacheKey(req, message.address);
      const cachedNonceData = config.cache.get(key) as CachedData | undefined;
      if (!cachedNonceData) {
        //# expired nonce
        const message = "Nonce has expired! Request a new one";
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(422).json({ status: false, message });
      }

      //# invalid nonce
      if (cachedNonceData.nonce !== message.nonce) {
        const message = "Invalid nonce set";
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(422).json({ status: false, message });
      }

      //# immediately trash away the nonce
      config.cache.del(key);
      //# verify stuffs >>>>>
      const signinMessage = new QuyxSIWS(message);
      const isSignerValid = signinMessage.validate(bs58.decode(signature));

      if (!isSignerValid) {
        const message = "Sign In verification failed!";
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(409).json({ status: false, message });
      }

      const { address } = message;

      //# does app has registered blacklisted Addresses?
      if (app!.blacklistedAddresses) {
        //# is address part of it?
        if (app!.blacklistedAddresses.includes(address)) {
          const message = `access blocked for ${address}, REASON::IS_BLACKLISTED`;
          await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

          return res.status(403).json({ status: false, message });
        }
      }

      //# does app has registered whitelisted Addresses?
      if (app!.whitelistedAddresses) {
        //# is address not part of it?
        if (!app!.whitelistedAddresses.includes(address)) {
          const message = `access blocked for ${address}, REASON::NOT_WHITELISTED`;
          await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

          return res.status(403).json({ status: false, message });
        }
      }

      //# upsert SDK user
      const sdkUser = await upsertSDKUser(
        { address, isActive: true, app: app!._id },
        { card: null, address, app: app!._id }
      );

      //# Creating a session
      const session = await createSession(
        sdkUser._id,
        QUYX_USER.SDK_USER,
        req.get("user-agent")
      );

      //# creating the payload
      const payload = {
        session: session._id,
        role: QUYX_USER.SDK_USER,
        identifier: sdkUser._id,
      };

      const accessToken = signJWT(payload, { expiresIn: config.ACCESS_TOKEN_TTL });
      const refreshToken = signJWT(payload, { expiresIn: config.REFRESH_TOKEN_TTL });

      await writeLog({ start, status: QUYX_LOG_STATUS.SUCCESSFUL }, app, req);
      return res.status(201).json({
        status: true,
        message: "Logged in successfully!",
        data: {
          accessToken,
          refreshToken,
        },
      });
    } catch (e: any) {
      const message = e.message || "unable to complete request";
      await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

      return res.status(500).json({ status: false, message });
    }
  }
);

//# getting info of the current logged in SDK user
router.get(
  "/whoami",
  hasAccessToSDK(),
  canAccessRoute(QUYX_USER.SDK_USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const { identifier } = res.locals.meta;
    const start = dateUTC().getTime();

    try {
      const sdkUser = await findSDKUser({ _id: identifier, isActive: true });
      if (!sdkUser) {
        const message = `user with _id: ${identifier} was not found`;
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(404).json({ status: false, message });
      }

      await writeLog({ start, status: QUYX_LOG_STATUS.SUCCESSFUL }, app, req);
      return res.json({
        status: true,
        messge: "User fetched",
        data: sdkUser,
      });
    } catch (e: any) {
      const message = e.message || "unable to complete request";
      await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

      return res.status(500).json({ status: false, message });
    }
  }
);

//# all owned cards of the logged in SDK user (with pagination)
router.get(
  "/cards",
  hasAccessToSDK(),
  canAccessRoute(QUYX_USER.SDK_USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const { identifier } = res.locals.meta;
    const start = dateUTC().getTime();

    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const sdkUser = await findSDKUser({ _id: identifier, isActive: true });
      if (!sdkUser) {
        const message = `user with _id: ${identifier} was not found`;
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(404).json({ status: false, message });
      }

      const quyxUser = await findUser({ address: sdkUser.address });
      if (!quyxUser) {
        //# has not interacted with Quyx before
        await writeLog({ start, status: QUYX_LOG_STATUS.SUCCESSFUL }, app, req);

        return res.status(200).json({
          status: true,
          message: "Cards fetched",
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            skip: (parseInt(page) - 1) * parseInt(limit),
            total: 0,
          },
        });
      }

      const filter = { owner: quyxUser.id, isDeleted: false };
      const totalCards = await countCards(filter);
      const cards = await findCards(filter, { limit: parseInt(limit), page: parseInt(page) });

      await writeLog({ start, status: QUYX_LOG_STATUS.SUCCESSFUL }, app, req);

      return res.json({
        status: true,
        message: "Fetched cards",
        data: cards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalCards,
        },
      });
    } catch (e: any) {
      const message = e.message || "unable to complete request";
      await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

      return res.status(500).json({ status: false, message });
    }
  }
);

//# changing sdkuser selected card
router.put(
  "/change/:id",
  hasAccessToSDK(),
  canAccessRoute(QUYX_USER.SDK_USER),
  validate(changeCardSDKSchema),
  async function (
    req: Request<ChangeCardSDK["params"], {}, ChangeCardSDK["body"]>,
    res: Response<{}, QuyxLocals>
  ) {
    const { app } = res.locals;
    const { identifier } = res.locals.meta;
    const start = dateUTC().getTime();
    const { id } = req.params;

    try {
      let shouldFilterSpam = false;
      if (typeof req.body?.filterSpam == "boolean") shouldFilterSpam == req.body.filterSpam;

      const card = await findCard({ _id: id });
      if (!card) {
        const message = `card with id/identifier of:${id} was not found`;
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(404).json({ status: false, message });
      }

      if (shouldFilterSpam && card.isFlagged) {
        const message = `Oops! app does not allow linking of spam cards`;
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(409).json({ status: false, message });
      }

      const sdkUser = await findSDKUser({ _id: identifier, isActive: true });
      if (!sdkUser) {
        const message = `user with _id: ${identifier} was not found`;
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(404).json({ status: false, message });
      }

      const quyxUser = await findUser({ address: sdkUser.address });
      if (!quyxUser || quyxUser._id != card.owner) {
        const message = `user with address: ${sdkUser.address} is not the owner of card '#${card.identifier}'`;
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(401).json({ status: false, message });
      }

      await updateSDKUser({ _id: identifier }, { card: card._id });

      await writeLog({ start, status: QUYX_LOG_STATUS.SUCCESSFUL }, app, req);
      return res.status(201).json({
        status: true,
        message: "Preferred card changed successfully",
      });
    } catch (e: any) {
      const message = e.message || "unable to complete request";
      await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

      return res.status(500).json({ status: false, message });
    }
  }
);

//# disconnect sdkUser from app
router.delete(
  "/disconnect",
  hasAccessToSDK(),
  canAccessRoute(QUYX_USER.SDK_USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const { identifier } = res.locals.meta;
    const start = dateUTC().getTime();

    try {
      await deleteSDKUser({ _id: identifier });

      await writeLog({ start, status: QUYX_LOG_STATUS.SUCCESSFUL }, app, req);
      return res.status(201).json({
        status: true,
        message: "Account disconnected sucessfully!",
      });
    } catch (e: any) {
      const message = e.message || "unable to complete request";
      await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

      return res.status(500).json({ status: false, message });
    }
  }
);

//# get all users under a sdk (with pagination or not) - apiKey is needed
router.get(
  "/users/all",
  hasAccessToSDK(true),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const start = dateUTC().getTime();

    try {
      const { limit, page, filterSpam } = req.query as {
        limit?: string;
        page?: string;
        filterSpam?: string;
      };

      let shouldFilterSpam = false;
      if (typeof filterSpam == "string" && filterSpam == "true") shouldFilterSpam = true;

      if (limit && page) {
        if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) {
          const message = `expected type number for limit & page in req.query`;
          await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

          return res.status(400).json({ status: false, message });
        }
      }

      const filter = {
        app: app!._id,
        isActive: true,
        ...(shouldFilterSpam ? { isFlagged: false } : {}),
      };

      const totalResults = await countSDKUsers(filter);
      const result = await findSDKUsers(filter, {
        limit: limit ? parseInt(limit) : totalResults,
        page: page ? parseInt(page) : 1,
      });

      await writeLog({ start, status: QUYX_LOG_STATUS.SUCCESSFUL }, app, req);
      return res.json({
        status: true,
        message: "Fetched users",
        data: result,
        ...(limit && page
          ? {
              pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                skip: (parseInt(page) - 1) * parseInt(limit),
                total: totalResults,
              },
            }
          : {}),
      });
    } catch (e: any) {
      const message = e.message || "unable to complete request";
      await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

      return res.status(500).json({ status: false, message });
    }
  }
);

//# get info from address or username
router.get(
  "/user/single/:param",
  hasAccessToSDK(true),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const { param } = req.params;
    const start = dateUTC().getTime();

    try {
      if (!param || typeof param !== "string") {
        const message = `expected type string, got: ${String(param)}`;
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(400).json({ status: false, message });
      }

      const sdkUser = await findSDKUser({
        app: app!._id,
        isActive: true,
        ...(isValidAddress(param)
          ? { address: param }
          : { "card.username": { $regex: param, $options: "i" } }),
      });

      if (!sdkUser) {
        const message = `no data found for: ${param}`;
        await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

        return res.status(404).json({ status: false, message });
      }

      await writeLog({ start, status: QUYX_LOG_STATUS.SUCCESSFUL }, app, req);
      return res.json({
        status: true,
        message: "Fetched user",
        data: sdkUser,
      });
    } catch (e: any) {
      const message = e.message || "unable to complete request";
      await writeLog({ start, status: QUYX_LOG_STATUS.FAILED, message }, app, req);

      return res.status(500).json({ status: false, message });
    }
  }
);

export = router;
