import { NextFunction, Response, Request } from "express";
import { get } from "lodash";
import crypto from "crypto";
import { findApp } from "../../modules/app/service";
import { addLog } from "../../modules/log/service";
import { QUYX_LOG_STATUS } from "./constants";
import config from "./config";
import { dateUTC } from "./helpers";

type Props = (typeof QUYX_USERS)[number];

type AddLogIfAppExistsProps = {
  route: string;
  status: QUYX_LOG_STATUS;
  start: number;
  message: string;
};

async function addLogIfAppExists(
  { route, status, start, message }: AddLogIfAppExistsProps,
  req: Request,
  app?: QuyxApp & { _id: string }
) {
  if (!app) return;

  await addLog({
    app: app._id,
    dev: app.owner,
    status,
    route,
    log: JSON.stringify({ body: req.body, params: req.params, query: req.query, message }),
    responseTime: dateUTC().getTime() - start,
    date: dateUTC(),
  });
}

export function canAccessRoute(role: Props | Props[]) {
  return async function (req: Request, res: Response<{}, QuyxLocals>, next: NextFunction) {
    const start = dateUTC().getTime();
    const message = "not authorized to acess this route";

    if (!res.locals.meta) {
      await addLogIfAppExists(
        { start, route: req.url, message, status: QUYX_LOG_STATUS.FAILED },
        req,
        res.locals.app
      );

      return res.status(401).json({ status: false, message });
    }

    if (typeof role === "string" && res.locals.meta.role !== role) {
      await addLogIfAppExists(
        { start, route: req.url, message, status: QUYX_LOG_STATUS.FAILED },
        req,
        res.locals.app
      );

      return res.status(401).json({ status: false, message });
    }

    if (Array.isArray(role) && !role.includes(res.locals.meta.role)) {
      await addLogIfAppExists(
        { start, route: req.url, message, status: QUYX_LOG_STATUS.FAILED },
        req,
        res.locals.app
      );

      return res.status(401).json({ status: false, message });
    }

    return next();
  };
}

export function hasAccessToSDK(onlyApiKeyIsAllowed: boolean = false) {
  return async function (req: Request, res: Response<{}, QuyxLocals>, next: NextFunction) {
    let app: any = null;

    const apiKey = get(req, "headers.quyx-api-key") ?? null;
    if (apiKey) {
      //# check that apiKey is valid...(xxxxxx)
      app = await findApp({ apiKey });
      if (!app) {
        return res.status(401).json({
          status: false,
          message: "invalid apiKey passed",
        });
      }
    }

    if (onlyApiKeyIsAllowed) {
      //# return error, use api key to access this route
      return res.status(401).json({
        status: false,
        message: "apiKey is required to access this route",
      });
    }

    //# no apiKey? check for clientID then.....
    const clientID = get(req, "headers.quyx-client-id") ?? null;
    if (!clientID) {
      //# no client id?
      return res.status(401).json({
        status: false,
        message: "apiKey/clientID is missing",
      });
    } else {
      app = await findApp({ clientID });
      //# no app found for clientId?
      if (!app) {
        return res.status(401).json({
          status: false,
          message: "invalid clientID passed",
        });
      }
    }

    // # blocking external apps - unsure....
    if (app.allowedBundleIDs) {
      const bundleID = (get(req, "headers.bundle-id") as string) ?? null;
      if (!bundleID || !app.allowedBundleIDs.includes(bundleID)) {
        return res.status(401).json({
          status: false,
          message: "access blocked from origin",
        });
      }
    }

    // # blocking external websites
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

    if (app) res.locals.app = app.toJSON();
    return next();
  };
}

export function isStreamSenderValid(req: Request, res: Response, next: NextFunction) {
  const signature = req.headers["x-signature"];
  if (!signature) res.sendStatus(403);

  const _signature = crypto
    .createHmac("sha256", config.STREAM_KEY)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (_signature !== signature) return res.sendStatus(401);

  return next();
}

export function isCronSenderValid(req: Request, res: Response, next: NextFunction) {
  const quyx_cron_header = get(req, "headers.quyx-cron-key") ?? null;
  if (!quyx_cron_header) return res.sendStatus(401);
  if (quyx_cron_header !== config.CRON_KEY) return res.sendStatus(401);

  return next();
}
