import express, { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import { findSession, findSessions, updateSession } from "./service";
import {
  dateUTC,
  getCacheKey,
  isValidAddress,
  removeCookie,
} from "../../shared/utils/helpers";
import config from "../../shared/utils/config";

const router = express.Router();

router.get("/nonce/:address", async function (req: Request, res: Response) {
  try {
    const { address } = req.params;
    if (!address || typeof address !== "string" || !isValidAddress(address)) {
      return res.sendStatus(400);
    }

    const key = getCacheKey(req, address);
    const cachedNonceData = config.cache.get(key) as CachedData | undefined;
    if (cachedNonceData) {
      return res.json({
        status: true,
        message: "Fetched nonce",
        data: cachedNonceData,
      });
    }

    const data: CachedData = {
      nonce: uuidv4(),
      issuedAt: dateUTC().toISOString(),
      expirationTime: dateUTC(dateUTC().getTime() + 5 * 60 * 1000).toISOString(),
    };

    //# adding nonce to cache
    config.cache.set(key, data);

    return res.json({
      status: true,
      message: "Fetched nonce",
      data,
    });
  } catch (e: any) {
    return res.status(500).json({
      status: false,
      message: e.message,
    });
  }
});

//# Get current session
router.get(
  "/current",
  canAccessRoute([QUYX_USER.DEV, QUYX_USER.SDK_USER, QUYX_USER.STAFF, QUYX_USER.USER]),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { session } = res.locals.meta;

      const resp = await findSession(session);
      if (!resp) return res.sendStatus(404);

      return res.status(200).json({
        status: true,
        message: "session fetched",
        data: resp,
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# Get all sessions
router.get(
  "/",
  canAccessRoute([QUYX_USER.DEV, QUYX_USER.SDK_USER, QUYX_USER.STAFF, QUYX_USER.USER]),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const data = await findSessions({ identifier, isActive: true });

      return res.status(200).json({
        status: true,
        message: "sessions fetched",
        data: data,
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# Log out current session
router.delete(
  "/",
  canAccessRoute([QUYX_USER.DEV, QUYX_USER.SDK_USER, QUYX_USER.STAFF, QUYX_USER.USER]),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { session, role } = res.locals.meta;

      const resp = await updateSession({ _id: session }, { isActive: false });
      if (!resp) return res.sendStatus(409);

      if (role === QUYX_USER.SDK_USER) {
        removeCookie(res, "sdk_accessToken");
        removeCookie(res, "sdk_refreshToken");
      } else {
        removeCookie(res, "accessToken");
        removeCookie(res, "refreshToken");
      }

      return res.sendStatus(201);
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

export = router;
