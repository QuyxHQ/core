import express from "express";
import cardRoutes from "../../modules/card/routes";
import userRoutes from "../../modules/user/routes";
import bookmarkRoutes from "../../modules/bookmarks/routes";
import devRoutes from "../../modules/dev/routes";
import sessionRoutes from "../../modules/session/routes";
import appRoutes from "../../modules/app/routes";
import logRoutes from "../../modules/log/routes";
import sdkRoutes from "../../modules/sdk/routes";
import cronRoutes from "../../modules/cron/routes";
import marketplaceRoutes from "../../modules/marketplace/routes";
import aiWaitlistRoutes from "../../modules/ai-waitlist/routes";
import referralRoutes from "../../modules/referral/routes";
import miscRoutes from "../../modules/misc/routes";
import streamRoutes from "../../modules/stream/routes";

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(200);

  next();
});

router.use("/card", cardRoutes);
router.use("/user", userRoutes);
router.use("/bookmark", bookmarkRoutes);
router.use("/dev", devRoutes);
router.use("/session", sessionRoutes);
router.use("/app", appRoutes);
router.use("/log", logRoutes);
router.use("/sdk", sdkRoutes);
router.use("/cron", cronRoutes);
router.use("/marketplace", marketplaceRoutes);
router.use("/ai-waitlist", aiWaitlistRoutes);
router.use("/referral", referralRoutes);
router.use("/misc", miscRoutes);
router.use("/stream", streamRoutes);

export = router;
