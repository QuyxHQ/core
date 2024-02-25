import express, { Request, Response } from "express";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import { addToAiWaitlist, countAiWaitlist, removeFromAiWaitlist } from "./service";

const router = express.Router();

router.post(
  "/",
  canAccessRoute(QUYX_USER.DEV),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      const userInWaitlistOccurence = await countAiWaitlist({ dev: identifier });
      if (userInWaitlistOccurence > 0) {
        return res.status(409).json({
          status: false,
          message: "user already in waitlist",
        });
      }

      await addToAiWaitlist({ dev: identifier });

      return res.status(201).json({
        status: true,
        message: "successfully in waitlist",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

router.get(
  "/",
  canAccessRoute(QUYX_USER.DEV),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const userInWaitlistOccurence = await countAiWaitlist({ dev: identifier });

      return res.json({
        status: true,
        message: "waitlist status fetched",
        data: userInWaitlistOccurence > 0, // true = yes! in waitlist
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

router.delete(
  "/",
  canAccessRoute(QUYX_USER.DEV),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      await removeFromAiWaitlist({ dev: identifier });

      return res.json({
        status: true,
        message: "user removed from waitlist",
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
