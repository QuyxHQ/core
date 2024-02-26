import express, { Request, Response } from "express";
import { canAccessRoute, hasAccessToSDK } from "../../shared/utils/validators";
import { QUYX_LOG_STATUS, QUYX_USER } from "../../shared/utils/constants";
import { addLog } from "../log/service";
import { SiweMessage } from "siwe";
import { SIWE, SIWESchema } from "../user/schema";
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
import { ChangeCardSDK, GetSDKUsers, changeCardSDKSchema, getSDKUsersSchema } from "./schema";
import { isAddress } from "ethers/lib/utils";
import { dateUTC } from "../../shared/utils/helpers";
import { deleteNonce, findNonce } from "../nonce/service";

const router = express.Router();

//# helper lgo fn
async function _log({
  app,
  dev,
  responseTime,
  route,
  status,
  log,
}: {
  app: string;
  dev: string;
  responseTime: number;
  route: string;
  status: QUYX_LOG_STATUS;
  log: string | null;
}) {
  await addLog({
    app,
    dev,
    responseTime,
    route,
    status,
    log,
    date: dateUTC(),
  });
}

//# logging in a SDK user
router.post(
  "/login",
  validate(SIWESchema),
  hasAccessToSDK,
  async function (req: Request<{}, {}, SIWE["body"]>, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const start = dateUTC().getTime();

    try {
      const { message, signature } = req.body;

      const nonce = await findNonce({ nonce: message.nonce });
      if (!nonce) {
        const log = {
          message: "invalid nonce set",
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: "/login",
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(422).json({
          status: false,
          message: log.message,
        });
      }

      if (dateUTC(nonce.expirationTime).getTime() < dateUTC().getTime()) {
        const log = {
          message: "nonce is expired! request a new one",
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: "/login",
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(400).json({
          status: false,
          message: log.message,
        });
      }

      if (message.nonce != nonce.nonce) {
        await deleteNonce({ _id: nonce._id });

        const log = {
          message: "invalid nonce set",
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: "/login",
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(422).json({
          status: false,
          message: log.message,
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
        const log = {
          message: resp.error?.type ?? "unable to verify message",
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: "/login",
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(409).json({
          status: false,
          message: log.message,
        });
      }

      const { address } = resp.data;

      if (app!.blacklistedAddresses) {
        if (app!.blacklistedAddresses.includes(address)) {
          const log = {
            message: `access blocked for ${address}, REASON::IS_BLACKLISTED`,
            body: req.body,
            params: req.params,
            query: req.query,
          };

          await _log({
            app: app!._id,
            dev: app!.owner,
            responseTime: dateUTC().getTime() - start,
            route: "/login",
            status: QUYX_LOG_STATUS.SUCCESSFUL,
            log: JSON.stringify(log),
          });

          return res.status(403).json({
            status: false,
            message: log.message,
          });
        }
      }

      if (app!.whitelistedAddresses) {
        if (!app!.whitelistedAddresses.includes(address)) {
          const log = {
            message: `access blocked for ${address}, REASON::NOT_WHITELISTED`,
            body: req.body,
            params: req.params,
            query: req.query,
          };

          await _log({
            app: app!._id,
            dev: app!.owner,
            responseTime: dateUTC().getTime() - start,
            route: "/login",
            status: QUYX_LOG_STATUS.SUCCESSFUL,
            log: JSON.stringify(log),
          });

          return res.status(403).json({
            status: false,
            message: log.message,
          });
        }
      }

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

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/login",
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        log: null,
      });

      return res.status(201).json({
        status: true,
        message: "logged in successfully!",
        data: {
          accessToken,
          refreshToken,
        },
      });
    } catch (e: any) {
      console.log(e);
      const log = {
        message: e.message ?? e.type ?? "unable to complete request",
        body: req.body,
        params: req.params,
        query: req.query,
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/login",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json({
        status: false,
        message: log.message,
      });
    }
  }
);

//# getting info of the current logged in SDK user
router.get(
  "/current",
  hasAccessToSDK,
  canAccessRoute(QUYX_USER.SDK_USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const { identifier } = res.locals.meta;
    const start = dateUTC().getTime();

    try {
      const sdkUser = await findSDKUser({ _id: identifier, isActive: true });
      if (!sdkUser) {
        const log = {
          message: `user with _id: ${identifier} was not found`,
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: "/current",
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(404).json({
          status: false,
          message: log.message,
        });
      }

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/current",
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        log: null,
      });

      return res.json({
        status: true,
        messge: "user fetched",
        data: sdkUser,
      });
    } catch (e: any) {
      const log = {
        message: e.message ?? "unable to complete request",
        body: req.body,
        params: req.params,
        query: req.query,
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/current",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json({
        status: false,
        message: log.message,
      });
    }
  }
);

//# all owned cards of the logged in SDK user (with pagination)
router.get(
  "/cards",
  hasAccessToSDK,
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
        const log = {
          message: `user with _id: ${identifier} was not found`,
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: "/cards",
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(404).json({
          status: false,
          message: log.message,
        });
      }

      const quyxUser = await findUser({ address: sdkUser.address });
      if (!quyxUser) {
        //# has not interacted with Quyx before
        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: "/cards",
          status: QUYX_LOG_STATUS.SUCCESSFUL,
          log: null,
        });

        return res.status(200).json({
          status: true,
          message: "cards fetched",
          data: [],
        });
      }

      const totalCards = await countCards({ owner: quyxUser.id, isDeleted: false });
      const cards = await findCards(
        { owner: quyxUser._id, isDeleted: false },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/cards",
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        log: null,
      });

      return res.json({
        status: true,
        message: "fetched cards",
        data: cards,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalCards,
        },
      });
    } catch (e: any) {
      const log = {
        message: e.message ?? "unable to complete request",
        body: req.body,
        params: req.params,
        query: req.query,
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/cards",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json({
        status: false,
        message: log.message,
      });
    }
  }
);

//# changining sdkuser selected card
router.put(
  "/change/:id",
  hasAccessToSDK,
  canAccessRoute(QUYX_USER.SDK_USER),
  validate(changeCardSDKSchema),
  async function (req: Request<ChangeCardSDK["params"]>, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const { identifier } = res.locals.meta;
    const start = dateUTC().getTime();
    const { id } = req.params;

    try {
      const card = await findCard({ _id: id });
      if (!card) {
        const log = {
          message: `card with id/identifier of:${id} was not found`,
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: `/change/${id}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(404).json({
          status: false,
          message: log.message,
        });
      }

      const sdkUser = await findSDKUser({ _id: identifier, isActive: true });
      if (!sdkUser) {
        const log = {
          message: `user with _id:${identifier} was not found`,
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: `/change/${id}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(404).json({
          status: false,
          message: log.message,
        });
      }

      const quyxUser = await findUser({ address: sdkUser.address });
      if (!quyxUser || quyxUser._id != card.owner) {
        const log = {
          message: `user with address: ${sdkUser.address} is not the owner of card '#${card.identifier}'`,
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: `/change/${id}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(401).json({
          status: false,
          message: log.message,
        });
      }

      await updateSDKUser({ _id: identifier }, { card: card._id });

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: `/change/${id}`,
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        log: null,
      });

      return res.status(201).json({
        status: true,
        message: "card changed successfully",
      });
    } catch (e: any) {
      const log = {
        message: e.message ?? "unable to complete request",
        body: req.body,
        params: req.params,
        query: req.query,
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: `/change/${id}`,
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json({
        status: false,
        message: log.message,
      });
    }
  }
);

//# disconnect sdkUser from app
router.delete(
  "/disconnect",
  hasAccessToSDK,
  canAccessRoute(QUYX_USER.SDK_USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const { identifier } = res.locals.meta;
    const start = dateUTC().getTime();

    try {
      await deleteSDKUser({ _id: identifier });

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/disconnect",
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        log: null,
      });

      return res.status(201).json({
        status: true,
        message: "account disconnected sucessfully!",
      });
    } catch (e: any) {
      const log = {
        message: e.message ?? "unable to complete request",
        body: req.body,
        params: req.params,
        query: req.query,
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/disconnect",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json({
        status: false,
        message: log.message,
      });
    }
  }
);

//# get all users under a sdk (with pagination or not)
router.get(
  "/users/all",
  hasAccessToSDK,
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const start = dateUTC().getTime();

    try {
      const { limit, page } = req.query as { limit?: string; page?: string };

      if (limit && page) {
        if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) {
          const log = {
            message: `expected type number for limit & page in req.query`,
            body: req.body,
            params: req.params,
            query: req.query,
          };

          await _log({
            app: app!._id,
            dev: app!.owner,
            responseTime: dateUTC().getTime() - start,
            route: "/users/all",
            status: QUYX_LOG_STATUS.FAILED,
            log: JSON.stringify(log),
          });

          return res.status(400).json({
            status: false,
            message: log.message,
          });
        }
      }

      const totalResults = await countSDKUsers({ app: app!._id, isActive: true });
      const result = await findSDKUsers(
        { app: app!._id, isActive: true },
        {
          limit: limit ? parseInt(limit) : totalResults,
          page: page ? parseInt(page) : 1,
        }
      );

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/users/all",
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        log: null,
      });

      return res.json({
        status: true,
        message: "fetched users",
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
      const log = {
        message: e.message ?? "unable to complete request",
        body: req.body,
        params: req.params,
        query: req.query,
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: "/users/all",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json({
        status: false,
        message: log.message,
      });
    }
  }
);

//# get info from address
router.get(
  "/user/single/:address",
  hasAccessToSDK,
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals;
    const { address } = req.params;
    const start = dateUTC().getTime();

    try {
      if (!address || typeof address !== "string" || !isAddress(address)) {
        const log = {
          message: `expected type address, got: ${String(address)}`,
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: `/user/${address}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(400).json({
          status: false,
          message: log.message,
        });
      }

      const sdkUser = await findSDKUser({ address, app: app!._id, isActive: true });
      if (!sdkUser) {
        const log = {
          message: `no data found for address: ${address}`,
          body: req.body,
          params: req.params,
          query: req.query,
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: dateUTC().getTime() - start,
          route: `/user/${address}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(404).json({
          status: false,
          message: log.message,
        });
      }

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: `/user/${address}`,
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        log: null,
      });

      return res.json({
        status: true,
        message: "fetched user",
        data: sdkUser,
      });
    } catch (e: any) {
      const log = {
        message: e.message ?? "unable to complete request",
        body: req.body,
        params: req.params,
        query: req.query,
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: dateUTC().getTime() - start,
        route: `/user/${address}`,
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json({
        status: false,
        message: log.message,
      });
    }
  }
);

//# get all users under an app (accessible by dev only ***NOT ON SDK***)
router.get(
  "/users/dev/:app",
  canAccessRoute(QUYX_USER.DEV),
  validate(getSDKUsersSchema),
  async function (req: Request<GetSDKUsers["params"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { app } = req.params;

      const totalUsers = await countSDKUsers({ app, isActive: true });
      const users = await findSDKUsers(
        { app, isActive: true },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched users",
        data: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalUsers,
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

export = router;
