import express, { Request, Response } from "express";
import {
  DeleteApp,
  EditApp,
  GetApp,
  RegisterApp,
  deleteAppSchema,
  editAppSchema,
  getAppSchema,
  registerAppSchema,
} from "./schema";
import validate from "../../shared/middlewares/validateSchema";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import { countApps, deleteApp, findApp, findApps, registerApp, updateApp } from "./service";
import { v4 as uuidv4 } from "uuid";
import { generateHash } from "../../shared/utils/helpers";
import { findDev } from "../dev/service";

const router = express.Router();

//# registering a new app
router.post(
  "/",
  canAccessRoute(QUYX_USER.DEV),
  validate(registerAppSchema),
  async function (req: Request<{}, {}, RegisterApp["body"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const dev = await findDev({ _id: identifier });
      if (dev && !dev.isEmailVerified) {
        return res.status(409).json({
          status: false,
          message: "email address must be verified first",
        });
      }

      //# check for duplicate app name
      const appNameOccurance = await countApps({
        owner: identifier,
        name: req.body.name,
        isActive: true,
      });

      if (appNameOccurance > 0) {
        return res.status(409).json({
          status: false,
          message: "app with similar name exists on this account",
        });
      }

      const apiKey = uuidv4();
      const clientID = generateHash();

      const app = await registerApp({ ...req.body, owner: identifier, apiKey, clientID });
      return res.status(201).json({
        status: true,
        message: "app registered successfully",
        data: app,
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# get all apps for the logged in dev
router.get(
  "/",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { identifier } = res.locals.meta;

      const totalApps = await countApps({ owner: identifier, isActive: true });
      const apps = await findApps(
        { owner: identifier, isActive: true },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched apps",
        data: apps,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalApps,
        },
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
  "/search",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string") return res.sendStatus(400);

      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { identifier } = res.locals.meta;

      const totalApps = await countApps({
        owner: identifier,
        isActive: true,
        name: { $regex: q, $options: "i" },
      });

      const apps = await findApps(
        { owner: identifier, isActive: true, name: { $regex: q, $options: "i" } },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched apps",
        data: apps,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalApps,
        },
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# get an existing app
router.get(
  "/single/:id",
  canAccessRoute(QUYX_USER.DEV),
  validate(getAppSchema),
  async function (req: Request<GetApp["params"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { id } = req.params;
      const { identifier } = res.locals.meta;

      const app = await findApp({ _id: id, isActive: true, owner: identifier });
      if (!app) return res.sendStatus(404);

      return res.status(200).json({
        status: true,
        message: "fetched app",
        data: app,
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# edit an existing app
router.put(
  "/:id",
  canAccessRoute(QUYX_USER.DEV),
  validate(editAppSchema),
  async function (
    req: Request<EditApp["params"], {}, EditApp["body"]>,
    res: Response<{}, QuyxLocals>
  ) {
    try {
      const { id } = req.params;
      const { identifier } = res.locals.meta;

      const resp = await updateApp({ _id: id, isActive: true, owner: identifier }, req.body);
      if (!resp) return res.sendStatus(409);

      return res.status(201).json({
        status: true,
        message: "app updated",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# delete an existing app
router.delete(
  "/:id",
  canAccessRoute(QUYX_USER.DEV),
  validate(deleteAppSchema),
  async function (req: Request<DeleteApp["params"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { id } = req.params;
      const { identifier } = res.locals.meta;

      const resp = await deleteApp({ _id: id, isActive: true, owner: identifier });
      if (!resp) return res.sendStatus(409);

      return res.status(201).json({
        status: true,
        message: "app deleted",
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
