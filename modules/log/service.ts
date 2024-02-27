import mongoose from "mongoose";
import Log, { LogDoc } from "./model";

export async function addLog(data: QuyxLog) {
  try {
    const resp = await Log.create(data);
    return resp;
  } catch (e: any) {
    if (e && e instanceof mongoose.Error.ValidationError) {
      for (let field in e.errors) {
        const errorMsg = e.errors[field].message;

        throw new Error(errorMsg);
      }
    }

    throw new Error(e);
  }
}

export async function countLog(filter?: mongoose.FilterQuery<LogDoc>) {
  try {
    const count = await Log.countDocuments(filter);
    return count;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findLog(filter: mongoose.FilterQuery<LogDoc>) {
  try {
    const log = await Log.findOne(filter);
    return log;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function findLogs(
  filter: mongoose.FilterQuery<LogDoc>,
  { limit, page }: FindProps
) {
  try {
    const logs = await Log.find(filter)
      .populate({ path: "app", select: "name isActive" })
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return logs;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function avgLogs(filter: mongoose.FilterQuery<LogDoc>): Promise<number> {
  try {
    const resp = await Log.find(filter);
    if (resp.length == 0) return 0;
    let totalResponseTime = 0;

    for (let item of resp) totalResponseTime += item.responseTime;
    return totalResponseTime / resp.length;
  } catch (e: any) {
    throw new Error(e);
  }
}
