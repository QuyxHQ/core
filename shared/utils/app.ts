import express, { NextFunction, Response } from "express";
import cors from "cors";
import appRouter from "./app.router";
import deserializeUser from "../middlewares/deserializeUser";
import * as Sentry from "@sentry/node";
import { ProfilingIntegration } from "@sentry/profiling-node";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import config from "./config";
import log from "./log";

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
  app.use(cookieParser());
  app.use(
    cors({
      origin: "*",
      credentials: true,
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
      ],
    })
  );

  app.use((_, res: Response, next: NextFunction) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");

    next();
  });

  app.use(deserializeUser); //to deserialize the user..

  app.get("/healthz", (_, res: Response) => res.sendStatus(200));
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
