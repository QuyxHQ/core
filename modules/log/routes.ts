import express, { Request, Response } from "express";
import { canAccessRoute } from "../../shared/utils/validators";
import { QUYX_LOG_STATUS, QUYX_USER } from "../../shared/utils/constants";
import { avgLogs, countLog, findLogs } from "./service";
import { countSDKUsers } from "../sdk/service";
import { countApps } from "../app/service";
import { dateUTC } from "../../shared/utils/helpers";

const router = express.Router();

router.get(
  "/app/metrics/:id",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { id: app } = req.params;

      const min5 = dateUTC();
      min5.setMinutes(min5.getMinutes() - 5);

      const hour1 = dateUTC();
      hour1.setHours(hour1.getHours() - 1);

      const hour24 = dateUTC();
      hour24.setHours(hour24.getHours() - 24);

      const [
        success_hour1,
        success_hour24,
        failed_hour1,
        failed_hour24,
        requests_hour24,
        total_requests,
        avg_response_time_min5,
        total_users,
      ] = await Promise.all([
        countLog({
          status: QUYX_LOG_STATUS.SUCCESSFUL,
          dev: identifier,
          app,
          date: { $gte: hour1 },
        }),
        countLog({
          status: QUYX_LOG_STATUS.SUCCESSFUL,
          dev: identifier,
          app,
          date: { $gte: hour24 },
        }),
        countLog({
          status: QUYX_LOG_STATUS.FAILED,
          dev: identifier,
          app,
          date: { $gte: hour1 },
        }),
        countLog({
          status: QUYX_LOG_STATUS.FAILED,
          dev: identifier,
          app,
          date: { $gte: hour24 },
        }),
        countLog({
          dev: identifier,
          app,
          date: { $gte: hour24 },
        }),
        countLog({ dev: identifier, app }),
        avgLogs({
          dev: identifier,
          app,
          date: { $gte: min5 },
        }),
        countSDKUsers({ app, isActive: true }),
      ]);

      const successRate_hour1 =
        success_hour1 + failed_hour1 == 0
          ? 0
          : ((success_hour1 / (success_hour1 + failed_hour1)) * 100).toFixed(1);

      const successRate_hour24 =
        success_hour24 + failed_hour24 == 0
          ? 0
          : ((success_hour24 / (success_hour24 + failed_hour24)) * 100).toFixed(1);

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
          total_users,
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

//# all logs for a dev
router.get(
  "/",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      const { limit = "10", page = "1" } = req.query as any;
      if (isNaN(parseInt(limit)) || isNaN(parseInt(page))) return res.sendStatus(400);

      const totalLogs = await countLog({ dev: identifier });
      const logs = await findLogs(
        { dev: identifier },
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

//# all logs for an app
router.get(
  "/app/status/all/:id",
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
        date: { $gte: dateUTC(from), $lt: dateUTC(to) },
      });

      const failed_requests = await countLog({
        status: QUYX_LOG_STATUS.FAILED,
        app,
        dev: identifier,
        date: { $gte: dateUTC(from), $lt: dateUTC(to) },
      });

      return res.json({
        status: true,
        message: "fetched",
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

//# total requests & total Apps (dev)
router.get(
  "/dev/metadata",
  canAccessRoute(QUYX_USER.DEV),
  async function (_: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;

      const [total_requests, total_apps] = await Promise.all([
        countLog({ dev: identifier }),
        countApps({ owner: identifier, isActive: true }),
      ]);

      return res.json({
        status: true,
        message: "fetched",
        data: {
          total_apps,
          total_requests,
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

      const hour24 = dateUTC();
      hour24.setHours(hour24.getHours() - 24);

      const success_24 = await countLog({
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        dev: identifier,
        date: { $gte: hour24 },
      });

      const failed_24 = await countLog({
        status: QUYX_LOG_STATUS.FAILED,
        dev: identifier,
        date: { $gte: hour24 },
      });

      return res.json({
        status: true,
        message: "fetched",
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

      const getCurrentWeekDates = (offset: number) => {
        const weekDates = [];

        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setHours(date.getHours() - (offset + i * 24));
          weekDates.push(date);
        }

        return weekDates;
      };

      const countLogs = async (startDate: Date, endDate: Date) => {
        return await countLog({
          dev: identifier,
          date: { $gte: startDate, $lt: endDate },
        });
      };

      const week1Dates = getCurrentWeekDates(0);
      const week2Dates = getCurrentWeekDates(7);

      const data: any = { week1: {}, week2: {} };
      let totalWeek1 = 0;
      let totalWeek2 = 0;

      for (let i = 0; i < 7; i++) {
        const dayStart = week1Dates[i];
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const count = await countLogs(dayStart, dayEnd);
        data.week1[`day${i + 1}`] = count;
        totalWeek1 += count;
      }

      for (let i = 0; i < 7; i++) {
        const dayStart = week2Dates[i];
        const dayEnd = new Date(dayStart);
        dayEnd.setDate(dayEnd.getDate() + 1);

        const count = await countLogs(dayStart, dayEnd);
        data.week2[`day${i + 1}`] = count;
        totalWeek2 += count;
      }

      return res.json({
        status: true,
        message: "fetched",
        data: {
          ...data,
          total_week_1: totalWeek1,
          total_week_2: totalWeek2,
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
  "/dev/health/custom",
  canAccessRoute(QUYX_USER.DEV),
  async function (req: Request, res: Response<{}, QuyxLocals>) {
    try {
      const { identifier } = res.locals.meta;
      const { from, to } = req.query as any;
      if (!from || !to) return res.sendStatus(400);

      const successful_requests = await countLog({
        status: QUYX_LOG_STATUS.SUCCESSFUL,
        dev: identifier,
        date: { $gte: dateUTC(from), $lte: dateUTC(to) },
      });

      const failed_requests = await countLog({
        status: QUYX_LOG_STATUS.FAILED,
        dev: identifier,
        date: { $gte: dateUTC(from), $lte: dateUTC(to) },
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
