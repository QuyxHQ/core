import express, { NextFunction, Response } from "express";
import cors from "cors";
import appRouter from "./app.router";
import deserializeUser from "../middlewares/deserializeUser";
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import helmet from "helmet";
import config from "./config";
import log from "./log";
import info from "../../contract/info.json";
import session from "express-session";

function createServer() {
  const app = express();

  Sentry.init({
    dsn: config.SENTRY_DSN,
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      new ProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
  });

  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());

  app.use(helmet());

  app.use(
    cors({
      origin: "*",
      methods: ["GET", "POST", "PUT", "DELETE"],
      allowedHeaders: [
        "Origin",
        "X-Requested-With",
        "Content-Type",
        "Accept",
        "Authorization",
        "cache",
        "X-Refresh",
        "X-Signature",
        "Quyx-Api-Key",
        "Quyx-Client-Id",
        "Quyx-Cron-Key",
        "Bundle-Id",
      ],
    })
  );

  app.use((_, res: Response, next: NextFunction) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");

    next();
  });

  const sesssionObj: any = {
    secret: config.EXPRESS_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  };

  if (config.IS_PROD) {
    app.set("trust proxy", 1);
    sesssionObj.cookie.secure = true;
  }

  app.use(session(sesssionObj));
  app.use(deserializeUser); //to deserialize the user..

  app.get("/healthz", (_, res: Response) => res.sendStatus(200));
  app.get("/supported-chains", (_, res: Response) => res.json(info));
  app.get("/metadata", (_, res: Response) => {
    return res.json({
      status: true,
      message: "metadata fetched",
      data: {
        SUDO_TTL: parseInt(config.SUDO_TTL),
        KYC_OTP_TTL: parseInt(config.KYC_OTP_TTL),
        HASH_TTL: parseInt(config.HASH_TTL),
        APP_PUBLIC_KEY: config.APP_PUBLIC_KEY,
      },
    });
  });
  app.use("/", appRouter);

  app.use(Sentry.Handlers.errorHandler());

  app.use(function onError(err: any, _: any, res: any, __: any) {
    log.error(err, "Error occured:");
    res.statusCode = 500;
    res.json({
      status: false,
      error_id: res.sentry,
      message: "unexpected error occured",
    });
  });

  return app;
}

export default createServer;
