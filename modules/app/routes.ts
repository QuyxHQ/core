import express, { Request, Response } from "express";
import {
  CheckDuplicateName,
  DeleteApp,
  EditApp,
  GetApp,
  RegisterApp,
  SearchApp,
  checkDuplicateAppNameschema,
  deleteAppSchema,
  editAppSchema,
  getAppSchema,
  registerAppSchema,
  searchAppSchema,
} from "./schema";
import validate from "../../shared/middlewares/validateSchema";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_USER } from "../../shared/utils/constants";
import { countApps, deleteApp, findApp, findApps, registerApp, updateApp } from "./service";
import { v4 as uuidv4 } from "uuid";
import { generateHash, generateUsernameSuggestion } from "../../shared/utils/helpers";
import { findDev } from "../dev/service";
import { getSDKUsersSchema, GetSDKUsers } from "../sdk/schema";
import { countSDKUsers, findSDKUsers } from "../sdk/service";

const router = express.Router();

router.get(
  "/check-for-duplicate-app-name",
  canAccessRoute(QUYX_USER.DEV),
  validate(checkDuplicateAppNameschema),
  async function (
    req: Request<{}, {}, {}, CheckDuplicateName["query"]>,
    res: Response<{}, QuyxLocals>
  ) {
    try {
      const { identifier } = res.locals.meta;
      const { name } = req.query;

      const appNameOccurance = await countApps({
        owner: identifier,
        name,
        isActive: true,
      });

      if (appNameOccurance == 0) {
        return res.status(200).json({
          status: true,
          message: "App name not taken",
        });
      }

      return res.status(409).json({
        status: false,
        message: `App registered as '${name}' already exist on your account`,
        data: generateUsernameSuggestion(name),
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

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
          message: "Email address must be verified first",
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
          message: `App registered as '${req.body.name}' already exist on your account`,
        });
      }

      const apiKey = uuidv4();
      const clientID = generateHash();

      const app = await registerApp({ ...req.body, owner: identifier, apiKey, clientID });
      return res.status(201).json({
        status: true,
        message: "App registered successfully",
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

      const filter = { owner: identifier, isActive: true };
      const totalApps = await countApps(filter);
      const apps = await findApps(filter, { limit: parseInt(limit), page: parseInt(page) });

      return res.json({
        status: true,
        message: "Fetched apps",
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
  validate(searchAppSchema),
  async function (
    req: Request<{}, {}, {}, SearchApp["query"]>,
    res: Response<{}, QuyxLocals>
  ) {
    try {
      const { q } = req.query;
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { identifier } = res.locals.meta;

      const filter = {
        owner: identifier,
        isActive: true,
        name: { $regex: q, $options: "i" },
      };

      const totalApps = await countApps(filter);
      const apps = await findApps(filter, { limit: parseInt(limit), page: parseInt(page) });

      return res.json({
        status: true,
        message: "Fetched apps",
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
        message: "Fetched app",
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
        message: "App updated successfully",
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
        message: "App deleted successfully",
      });
    } catch (e: any) {
      return res.status(500).json({
        status: false,
        message: e.message,
      });
    }
  }
);

//# get all users under an app
router.get(
  "/users/:app",
  canAccessRoute(QUYX_USER.DEV),
  validate(getSDKUsersSchema),
  async function (req: Request<GetSDKUsers["params"]>, res: Response<{}, QuyxLocals>) {
    try {
      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const { app } = req.params;

      const totalUsers = await countSDKUsers({ app, isActive: true });
      const users = await findSDKUsers(
        { app, isActive: true },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "Fetched users",
        data: users,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalUsers,
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

export = router;
