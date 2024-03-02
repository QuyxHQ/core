import crypto from "crypto";
import { findApp } from "../../modules/app/service";
import axios, { AxiosError } from "axios";
import log from "./log";

type Props = { payload: Object; event: (typeof QUYX_EVENTS)[number]; app: string };
export async function sendWebhook({ payload, event, app }: Props, retryCount = 0) {
  const body = { event, data: payload };

  const appInfo = await findApp({ _id: app });
  if (!appInfo) return;
  if (!appInfo.webhook) return;

  log.info(`Sending to ${appInfo.webhook}`);

  try {
    const signature = crypto
      .createHmac("sha256", appInfo.apiKey)
      .update(JSON.stringify(body))
      .digest("hex");

    const response = await axios.post(appInfo.webhook, body, {
      headers: {
        "x-quyx-signature": signature,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      timeout: 5000,
    });

    log.info(
      {
        error: false,
        statusCode: response.status,
        data: response.data,
      },
      "response"
    );
  } catch (e: any) {
    log.error("Failed");

    if (e && e instanceof AxiosError) {
      log.error(
        {
          error: false,
          statusCode: e.status,
          data: e.response?.data,
        },
        "response"
      );

      if (retryCount < 5) {
        // Retry with exponential backoff
        const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff delay in milliseconds
        log.info(`Retrying - send to ${appInfo.webhook} in ${delay / 1000} seconds...`);

        setTimeout(() => sendWebhook({ payload, event, app }, retryCount + 1), delay);
      } else log.error(`Max attempt reached while sending webhook to ${appInfo.webhook}`);
    } else console.error(e);
  }

  return;
}
