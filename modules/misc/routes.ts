import express, { Request, Response } from "express";
import config from "../../shared/utils/config";
import validate from "../../shared/middlewares/validateSchema";
import { VerifyQuyxJWT, verifyQuyxJWTSchema } from "./schema";
import { verifyJWT } from "../../shared/utils/jwt";

const router = express.Router();

router.post(
  "/verify-jwt",
  validate(verifyQuyxJWTSchema),
  async function (req: Request<{}, {}, VerifyQuyxJWT["body"]>, res: Response) {
    try {
      const { token } = req.body;
      const response = verifyJWT(token);

      return res.status(response.valid ? 200 : 400).json({
        status: response.valid,
        message: response.message || "token verified",
        data: response,
      });
    } catch (e: any) {
      return res.status(500).json({ status: false, message: e.message });
    }
  }
);

router.get("/metadata", async function (_: any, res: Response) {
  return res.json({
    status: true,
    message: "metadata fetched",
    data: {
      SUDO_TTL: parseInt(config.SUDO_TTL),
      KYC_OTP_TTL: parseInt(config.KYC_OTP_TTL),
      HASH_TTL: parseInt(config.HASH_TTL),
    },
  });
});

export = router;
