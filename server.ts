import httpServer from "./shared/utils/httpServer";
import config from "./shared/utils/config";
import log from "./shared/utils/log";
import mongoose from "mongoose";

if (!config.MONGODB_URI) throw new Error(".env var: MONGODB_URI is missing");
log.info("Spinning up server on port 8085");

mongoose
  .connect(config.MONGODB_URI)
  .then(() => main())
  .catch((e) => log.error(e));

function main() {
  httpServer.listen(8085, () => log.info("Server is running on port: 8085"));
}
