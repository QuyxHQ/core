import { NextFunction, Response, Request } from "express";
import { get } from "lodash";
import { findApp } from "../../modules/app/service";
import { addLog } from "../../modules/log/service";
import { QUYX_LOG_STATUS } from "./constants";
import { ethers } from "ethers";
import config from "./config";
import { dateUTC } from "./helpers";

type Props = (typeof QUYX_USERS)[number];

export function canAccessRoute(role: Props | Props[]) {
  return async function (req: Request, res: Response<{}, QuyxLocals>, next: NextFunction) {
    const start = dateUTC().getTime();

    if (!res.locals.meta) {
      if (res.locals.app) {
        //# log the unauthorized error
        const { app } = res.locals;

        await addLog({
          app: app._id,
          dev: app.owner,
          status: QUYX_LOG_STATUS.FAILED,
          route: "*",
          log: JSON.stringify({
            message: "not authorized to acess this route",
            body: req.body,
            params: req.params,
            query: req.query,
          }),
          responseTime: dateUTC().getTime() - start,
          date: dateUTC(),
        });
      }

      return res.status(401).json({
        status: false,
        message: "not authorized to acess this route",
      });
    }

    if (typeof role === "string" && res.locals.meta.role !== role) {
      if (res.locals.app) {
        //# log the unauthorized error
        const { app } = res.locals;

        await addLog({
          app: app._id,
          dev: app.owner,
          status: QUYX_LOG_STATUS.FAILED,
          route: "*",
          log: JSON.stringify({
            message: "not authorized to acess this route",
            body: req.body,
            params: req.params,
            query: req.query,
          }),
          responseTime: dateUTC().getTime() - start,
          date: dateUTC(),
        });
      }

      return res.status(401).json({
        status: false,
        message: "not authorized to acess this route",
      });
    }

    if (Array.isArray(role) && !role.includes(res.locals.meta.role)) {
      if (res.locals.app) {
        //# log the unauthorized error
        const { app } = res.locals;

        await addLog({
          app: app._id,
          dev: app.owner,
          status: QUYX_LOG_STATUS.FAILED,
          route: "*",
          log: JSON.stringify({
            message: "not authorized to acess this route",
            body: req.body,
            params: req.params,
            query: req.query,
          }),
          responseTime: dateUTC().getTime() - start,
          date: dateUTC(),
        });
      }

      return res.sendStatus(401);
    }

    return next();
  };
}

export async function hasAccessToSDK(
  req: Request,
  res: Response<{}, QuyxLocals>,
  next: NextFunction
) {
  try {
    const apiKey = get(req, "headers.quyx-api-key") ?? null;
    if (apiKey) {
      //# check that apiKey is valid...(xxxxxx)
      const app = await findApp({ apiKey });
      if (!app) {
        return res.status(401).json({
          status: false,
          message: "invalid apiKey passed",
        });
      }

      res.locals.app = app;
      return next();
    }

    //# no apiKey? check for clientID then.....
    const clientID = get(req, "headers.quyx-client-id") ?? null;
    if (!clientID) {
      return res.status(401).json({
        status: false,
        message: "apiKey/clientID is missing",
      });
    }

    const app = await findApp({ clientID });
    if (!app) {
      return res.status(401).json({
        status: false,
        message: "invalid clientID passed",
      });
    }

    if (app.allowedBundleIDs) {
      const bundleID = (get(req, "headers.bundle-id") as string) ?? null;
      if (!bundleID || !app.allowedBundleIDs.includes(bundleID)) {
        return res.status(401).json({
          status: false,
          message: "access blocked from origin",
        });
      }
    }

    if (app.allowedDomains) {
      const origin = get(req, "headers.origin") ?? get(req, "headers.referer") ?? null;
      const domain = origin ? new URL(origin).hostname : null;
      if (
        !domain ||
        (!app.allowedDomains.includes(domain) &&
          domain != new URL(config.DEV_BASE_URL).hostname)
      ) {
        return res.status(401).json({
          status: false,
          message: "access blocked from origin",
        });
      }
    }

    res.locals.app = app;
    return next();
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
}

export function isFromMoralis(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers["x-signature"];
  if (!signature) res.sendStatus(403);

  const _signature = ethers.utils.id(JSON.stringify(req.body) + config.MORALIS_SECRET);
  if (_signature !== signature) return res.sendStatus(401);

  return next();
}

export function cronSenderIsValid(req: Request, res: Response, next: NextFunction) {
  const quyx_cron_header = get(req, "headers.quyx-cron-key") ?? null;
  if (!quyx_cron_header) return res.sendStatus(401);
  if (quyx_cron_header != config.CRON_KEY) return res.sendStatus(401);

  return next();
}
