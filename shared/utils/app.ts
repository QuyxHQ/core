import express from "express";
import cors from "cors";
import appRouter from "./app.router";
import deserializeUser from "../middlewares/deserializeUser";

function createServer() {
  const app = express();

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
      ],
    })
  );

  app.use((_, res, next) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");

    next();
  });

  app.use(deserializeUser); //to deserialize the user..

  app.get("/healthz", (_, res) => res.sendStatus(200));
  app.use("/", appRouter);

  app.use((_, res) => {
    res.status(500).json({
      status: false,
      message: "broken or missing link",
    });
  });

  return app;
}

export default createServer;
