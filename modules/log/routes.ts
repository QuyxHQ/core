import express, { Request, Response } from "express";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_LOG_STATUS, QUYX_USER } from "../../shared/utils/constants";
import { avgLogs, countLog, findLogs } from "./service";

const router = express.Router();

router.get(
  "/app/metadata/:id",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { id: app } = req.params;

      const min5 = new Date();
      min5.setMinutes(min5.getMinutes() - 5);

      const hour1 = new Date();
      hour1.setHours(hour1.getHours() - 1);

      const hour24 = new Date();
      hour24.setHours(hour24.getHours() - 24);

      const [
        success_hour1,
        success_hour24,
        failed_hour1,
        failed_hour24,
        requests_hour24,
        total_requests,
        avg_response_time_min5,
      ] = await Promise.all([
        countLog({
          status: QUYX_LOG_STATUS.SUCCESSFUL,
          dev: identifier,
          app,
          createdAt: { $gte: hour1 },
        }),
        countLog({
          status: QUYX_LOG_STATUS.SUCCESSFUL,
          dev: identifier,
          app,
          createdAt: { $gte: hour24 },
        }),
        countLog({
          status: QUYX_LOG_STATUS.FAILED,
          dev: identifier,
          app,
          createdAt: { $gte: hour1 },
        }),
        countLog({
          status: QUYX_LOG_STATUS.FAILED,
          dev: identifier,
          app,
          createdAt: { $gte: hour24 },
        }),
        countLog({
          dev: identifier,
          app,
          createdAt: { $gte: hour24 },
        }),
        countLog({ dev: identifier, app }),
        avgLogs({
          dev: identifier,
          app,
          createdAt: { $gte: min5 },
        }),
      ]);

      const successRate_hour1 = (success_hour1 / (success_hour1 + failed_hour1)) * 100;
      const successRate_hour24 =
        (success_hour24 / (success_hour24 + failed_hour24)) * 100;

      return res.status(200).json({
        status: true,
        message: "fetched",
        data: {
          success_hour1,
          success_hour24,
          failed_hour1,
          failed_hour24,
          requests_hour24,
          total_requests,
          avg_response_time_min5,
          successRate_hour1,
          successRate_hour24,
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

//# all logs for an app
router.get(
  "/app/status/:id",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { id: app } = req.params;

      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const totalLogs = await countLog({ dev: identifier, app });
      const logs = await findLogs(
        { dev: identifier, app },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched logs",
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalLogs,
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

//# all successful logs for an app
router.get(
  "/app/status/successful/:id",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { id: app } = req.params;

      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const totalLogs = await countLog({
        dev: identifier,
        app,
        status: QUYX_LOG_STATUS.SUCCESSFUL,
      });

      const logs = await findLogs(
        { dev: identifier, app, status: QUYX_LOG_STATUS.SUCCESSFUL },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched logs",
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalLogs,
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

//# all failed logs for an app
router.get(
  "/app/status/failed/:id",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { id: app } = req.params;

      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const totalLogs = await countLog({
        dev: identifier,
        app,
        status: QUYX_LOG_STATUS.FAILED,
      });

      const logs = await findLogs(
        { dev: identifier, app, status: QUYX_LOG_STATUS.FAILED },
        { limit: parseInt(limit), page: parseInt(page) }
      );

      return res.json({
        status: true,
        message: "fetched logs",
        data: logs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          skip: (parseInt(page) - 1) * parseInt(limit),
          total: totalLogs,
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

//# custom request health (app)
router.get(
  "/app/health/:id",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { id: app } = req.params;

      const { from, to } = req.query as any;

      const successful_requests = await countLog({
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        app,
        dev: identifier,
        createdAt: { $gte: new Date(from), $lt: new Date(to) },
      });

      const failed_requests = await countLog({
        status: QUYX_LOG_STATUS.FAILED,
        app,
        dev: identifier,
        createdAt: { $gte: new Date(from), $lt: new Date(to) },
      });

      return res.json({
        status: true,
        data: {
          successful_requests,
          failed_requests,
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

//# daily request health (dev)
router.get(
  "/dev/health",
  canAccessRoute(QUYX_USER.DEV),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      const hour24 = new Date();
      hour24.setHours(hour24.getHours() - 24);

      const success_24 = await countLog({
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        dev: identifier,
        createdAt: { $gte: hour24 },
      });

      const failed_24 = await countLog({
        status: QUYX_LOG_STATUS.FAILED,
        dev: identifier,
        createdAt: { $gte: hour24 },
      });

      return res.json({
        status: true,
        data: {
          success_24,
          failed_24,
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

//# weekly request growth (dev)
router.get(
  "/dev/growth",
  canAccessRoute(QUYX_USER.DEV),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      const week1 = new Date();
      week1.setHours(week1.getHours() - 24 * 7);

      const week2 = new Date();
      week2.setHours(week1.getHours() - 24 * 7);

      const requests_week_1 = await countLog({
        dev: identifier,
        createdAt: { $gte: week1 },
      });

      const requests_week_2 = await countLog({
        dev: identifier,
        createdAt: { $gte: week2, $lt: week1 },
      });

      return res.json({
        status: true,
        data: {
          requests_week_1,
          requests_week_2,
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

//# custom request health (dev)
router.get(
  "/dev/health",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { from, to } = req.query as any;

      const successful_requests = await countLog({
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        dev: identifier,
        createdAt: { $gte: new Date(from), $lt: new Date(to) },
      });

      const failed_requests = await countLog({
        status: QUYX_LOG_STATUS.FAILED,
        dev: identifier,
        createdAt: { $gte: new Date(from), $lt: new Date(to) },
      });

      return res.json({
        status: true,
        data: {
          successful_requests,
          failed_requests,
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
