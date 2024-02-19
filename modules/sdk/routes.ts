import express, { Request, Response } from "express";
import { canAccessRoute, hasAccessToSDK } from "../../shared/utils/validators";
import { QUYX_LOG_STATUS, QUYX_USER } from "../../shared/utils/constants";
import { addLog } from "../log/service";
import { SiweMessage } from "siwe";
import { ethers } from "ethers";
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
  });
}

//# logging in a SDK user
router.post(
  "/login",
  validate(SIWESchema),
  hasAccessToSDK,
  async function (req: Request<{}, {}, SIWE["body"]>, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals.meta;
    const start = Date.now();

    try {
      const { message, signature } = req.body;

      const messageSIWE = new SiweMessage(message);
      const provider = ethers.getDefaultProvider();

      const resp = await messageSIWE.verify(
        {
          signature,
          domain: message.domain,
          nonce: message.nonce,
        },
        { provider }
      );

      if (!resp.success) {
        const log = {
          status: false,
          message: resp.error?.type,
          data: {
            meta: {
              expected: resp.error?.expected,
              received: resp.error?.received,
            },
            body: req.body,
            params: req.params,
            query: req.query,
          },
        };

        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: Date.now() - start,
          route: "/login",
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify(log),
        });

        return res.status(400).json(log);
      }

      const { address } = resp.data;

      if (app!.blacklistedAddresses) {
        if (app!.blacklistedAddresses.includes(address)) {
          const log = {
            status: false,
            message: `access blocked for ${address}, REASON::IS_BLACKLISTED`,
          };

          await _log({
            app: app!._id,
            dev: app!.owner,
            responseTime: Date.now() - start,
            route: "/login",
            status: QUYX_LOG_STATUS.SUCCESSFUL,
            log: JSON.stringify(log),
          });

          return res.status(200).json(log);
        }
      }

      if (app!.whitelistedAddresses) {
        if (!app!.whitelistedAddresses.includes(address)) {
          const log = {
            status: false,
            message: `access blocked for ${address}, REASON::NOT_WHITELISTED`,
          };

          await _log({
            app: app!._id,
            dev: app!.owner,
            responseTime: Date.now() - start,
            route: "/login",
            status: QUYX_LOG_STATUS.SUCCESSFUL,
            log: JSON.stringify(log),
          });

          return res.status(200).json(log);
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
        responseTime: Date.now() - start,
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
      const log = {
        status: false,
        message: e.message,
        data: {
          body: req.body,
          params: req.params,
          query: req.query,
        },
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
        route: "/login",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json(log);
    }
  }
);

//# getting info of the current logged in SDK user
router.get(
  "/current",
  hasAccessToSDK,
  canAccessRoute(QUYX_USER.SDK_USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app, identifier } = res.locals.meta;
    const start = Date.now();

    try {
      const sdkUser = await findSDKUser({ _id: identifier, isActive: true });
      if (!sdkUser) {
        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: Date.now() - start,
          route: "/current",
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify({
            status: false,
            message: `user with _id: ${identifier} was not found`,
            data: {
              body: req.body,
              params: req.params,
              query: req.query,
            },
          }),
        });

        return res.sendStatus(404);
      }

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
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
        status: false,
        message: e.message,
        data: {
          body: req.body,
          params: req.params,
          query: req.query,
        },
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
        route: "/current",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json(log);
    }
  }
);

//# all owned cards of the logged in SDK user (with pagination)
router.get(
  "/cards",
  hasAccessToSDK,
  canAccessRoute(QUYX_USER.SDK_USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app, identifier } = res.locals.meta;
    const start = Date.now();

    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const sdkUser = await findSDKUser({ _id: identifier, isActive: true });
      if (!sdkUser) {
        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: Date.now() - start,
          route: "/cards",
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify({
            status: false,
            message: `user with _id: ${identifier} was not found`,
            data: {
              body: req.body,
              params: req.params,
              query: req.query,
            },
          }),
        });

        return res.sendStatus(404);
      }

      const quyxUser = await findUser({ address: sdkUser.address });
      if (!quyxUser) {
        //# has not interacted with Quyx before
        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: Date.now() - start,
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
        responseTime: Date.now() - start,
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
        status: false,
        message: e.message,
        data: {
          body: req.body,
          params: req.params,
          query: req.query,
        },
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
        route: "/cards",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json(log);
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
    const { app, identifier } = res.locals.meta;
    const start = Date.now();
    const { id: cardId } = req.params;

    try {
      const card = await findCard({ identifier: cardId });
      if (!card) {
        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: Date.now() - start,
          route: `/change/${cardId}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify({
            status: false,
            message: `card with id/identifier of:${cardId} was not found`,
            data: {
              body: req.body,
              params: req.params,
              query: req.query,
            },
          }),
        });

        return res.sendStatus(404);
      }

      const sdkUser = await findSDKUser({ _id: identifier, isActive: true });
      if (!sdkUser) {
        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: Date.now() - start,
          route: `/change/${cardId}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify({
            status: false,
            message: `user with _id:${identifier} was not found`,
            data: {
              body: req.body,
              params: req.params,
              query: req.query,
            },
          }),
        });

        return res.sendStatus(404);
      }

      const quyxUser = await findUser({ address: sdkUser.address });
      if (!quyxUser || quyxUser._id != card.owner) {
        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: Date.now() - start,
          route: `/change/${cardId}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify({
            status: false,
            message: `user with address: ${sdkUser.address} is not the owner of card '#${cardId}'`,
            data: {
              body: req.body,
              params: req.params,
              query: req.query,
            },
          }),
        });

        return res.sendStatus(401);
      }

      await updateSDKUser({ _id: identifier }, { card: card._id });

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
        route: `/change/${cardId}`,
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        log: null,
      });

      return res.status(201).json({
        status: true,
        message: "card changed successfully",
      });
    } catch (e: any) {
      const log = {
        status: false,
        message: e.message,
        data: {
          body: req.body,
          params: req.params,
          query: req.query,
        },
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
        route: `/change/${cardId}`,
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json(log);
    }
  }
);

//# disconnect sdkUser from app
router.delete(
  "/disconnect",
  hasAccessToSDK,
  canAccessRoute(QUYX_USER.SDK_USER),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app, identifier } = res.locals.meta;
    const start = Date.now();

    try {
      await deleteSDKUser({ _id: identifier });

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
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
        status: false,
        message: e.message,
        data: {
          body: req.body,
          params: req.params,
          query: req.query,
        },
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
        route: "/disconnect",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json(log);
    }
  }
);

//# get all users under a sdk (with pagination or not)
router.get(
  "/users/all",
  hasAccessToSDK,
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals.meta;
    const start = Date.now();

    try {
      const { limit, page } = req.query as { limit?: string; page?: string };

      if (limit && page) {
        if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) {
          await _log({
            app: app!._id,
            dev: app!.owner,
            responseTime: Date.now() - start,
            route: "/users/all",
            status: QUYX_LOG_STATUS.FAILED,
            log: JSON.stringify({
              status: false,
              message: `expected type number for limit & page in req.query`,
              data: {
                body: req.body,
                params: req.params,
                query: req.query,
              },
            }),
          });

          return res.sendStatus(400);
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
        responseTime: Date.now() - start,
        route: "/users/all",
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        log: null,
      });

      return res.json({
        status: true,
        message: "fetched users",
        data: result,
        pagination:
          limit && page
            ? {
                page: parseInt(page),
                limit: parseInt(limit),
                skip: (parseInt(page) - 1) * parseInt(limit),
                total: totalResults,
              }
            : undefined,
      });
    } catch (e: any) {
      const log = {
        status: false,
        message: e.message,
        data: {
          body: req.body,
          params: req.params,
          query: req.query,
        },
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
        route: "/users/all",
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json(log);
    }
  }
);

//# get info from address
router.get(
  "/user/:address",
  hasAccessToSDK,
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    const { app } = res.locals.meta;
    const { address } = req.params;
    const start = Date.now();

    try {
      if (!address || typeof address !== "string") {
        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: Date.now() - start,
          route: `/user/${address}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify({
            status: false,
            message: `expected type string, got: ${String(address)}`,
            data: {
              body: req.body,
              params: req.params,
              query: req.query,
            },
          }),
        });

        return res.sendStatus(400);
      }

      const sdkUser = await findSDKUser({ address, app: app!._id, isActive: true });
      if (!sdkUser) {
        await _log({
          app: app!._id,
          dev: app!.owner,
          responseTime: Date.now() - start,
          route: `/user/${address}`,
          status: QUYX_LOG_STATUS.FAILED,
          log: JSON.stringify({
            status: false,
            message: `no data found for address: ${address}`,
          }),
        });

        return res.sendStatus(404);
      }

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
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
        status: false,
        message: e.message,
        data: {
          body: req.body,
          params: req.params,
          query: req.query,
        },
      };

      await _log({
        app: app!._id,
        dev: app!.owner,
        responseTime: Date.now() - start,
        route: `/user/${address}`,
        status: QUYX_LOG_STATUS.FAILED,
        log: JSON.stringify(log),
      });

      return res.status(500).json(log);
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
