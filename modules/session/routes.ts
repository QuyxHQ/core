import express, { Request, Response } from "express";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import { findSession, findSessions, updateSession } from "./service";
import { v4 as uuidv4 } from "uuid";
import { dateUTC } from "../../shared/utils/helpers";

const router = express.Router();

router.get("/nonce", async function (req: Request, res: Response) {
  try {
    const nonce = uuidv4();
    const issuedAt = dateUTC().toISOString();
    const expirationDate = dateUTC(dateUTC().getTime() + 5 * 60 * 1000).toISOString();

    (req.session as any).nonce = nonce;
    (req.session as any).issuedAt = issuedAt;
    (req.session as any).expirationDate = expirationDate;
    req.session.save();

    return res.json({
      status: true,
      message: "fetched nonce",
      data: {
        nonce,
        issuedAt,
        expirationDate,
      },
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
      const { session } = res.locals.meta;

      const resp = await updateSession({ _id: session }, { isActive: false });
      if (!resp) return res.sendStatus(409);

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
