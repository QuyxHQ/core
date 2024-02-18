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
      .limit(limit)
      .skip((page - 1) * limit)
      .lean();

    return logs;
  } catch (e: any) {
    throw new Error(e);
  }
}

export async function avgLogs(filter: mongoose.FilterQuery<LogDoc>): Promise<number> {
  const avg_response_time = await Log.aggregate([
    { $match: filter },
    { $group: { _id: null, avgResponseTime: { $avg: "$responseTime" } } },
  ]);

  console.log(avg_response_time);

  return avg_response_time.length > 0 ? avg_response_time[0].avgResponseTime : 0;
}
