import express, { Request, Response } from "express";
import axios from "axios";
import FormData from "form-data";
import cardRoutes from "../../modules/card/routes";
import userRoutes from "../../modules/user/routes";
import bidRoutes from "../../modules/bid/routes";
import bookmarkRoutes from "../../modules/bookmarks/routes";
import devRoutes from "../../modules/dev/routes";
import sessionRoutes from "../../modules/session/routes";
import appRoutes from "../../modules/app/routes";
import logRoutes from "../../modules/log/routes";
import sdkRoutes from "../../modules/sdk/routes";
import webhookRoutes from "../../modules/webhook/routes";
import marketplaceRoutes from "../../modules/marketplace/routes";
import aiWaitlistRoutes from "../../modules/ai-waitlist/routes";
import referralRoutes from "../../modules/referral/routes";
import config from "./config";

const router = express.Router();

router.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(200);

  next();
});

router.use("/card", cardRoutes);
router.use("/user", userRoutes);
router.use("/bid", bidRoutes);
router.use("/bookmark", bookmarkRoutes);
router.use("/dev", devRoutes);
router.use("/session", sessionRoutes);
router.use("/app", appRoutes);
router.use("/log", logRoutes);
router.use("/sdk", sdkRoutes);
router.use("/webhook", webhookRoutes);
router.use("/marketplace", marketplaceRoutes);
router.use("/ai-waitlist", aiWaitlistRoutes);
router.use("/referral", referralRoutes);
router.post("/upload-image", async function (req: Request, res: Response) {
  try {
    const { base64 } = req.body;
    if (!base64 || typeof base64 !== "string") return res.sendStatus(400);

    const { IMAGE_UPLOAD_ENDPOINT, IMAGE_UPLOAD_KEY } = config;

    let formData = new FormData();
    formData.append("action", "upload");
    formData.append("key", IMAGE_UPLOAD_KEY);
    formData.append("format", "json");
    formData.append("source", base64);

    const { data } = await axios.post(IMAGE_UPLOAD_ENDPOINT, formData, {
      headers: formData.getHeaders(),
    });

    let uri;

    if (data?.status_code === 200 && data?.success?.code === 200) {
      uri = (data?.image?.url as string) ?? null;
    }

    return res.json({
      status: true,
      message: "image uploaded successfully!",
      data: { uri },
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

export = router;
