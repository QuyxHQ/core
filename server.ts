import httpServer from "./shared/utils/httpServer";
import config from "./shared/utils/config";
import log from "./shared/utils/log";
import mongoose from "mongoose";
import Moralis from "moralis";

if (!config.MONGODB_URI) throw new Error(".env var: MONGODB_URI is missing");
if (!config.MORALIS_SECRET) throw new Error(".env var: MORALIS_SECRET is missing");
log.info("Connecting to mongodb >>>>>>");

mongoose
  .connect(config.MONGODB_URI)
  .then(() => main())
  .catch((e) => log.error(e));

async function main() {
  log.info("Connected to mongodb successfully ✅");
  log.info("Connecting to moralis >>>>>>");

  await Moralis.start({ apiKey: config.MORALIS_SECRET });
  log.info("Connected to moralis successfully ✅");

  httpServer.listen(8085, () => log.info("Server is running on port: 8085"));
}
