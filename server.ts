import mongoose from "mongoose";
import { Server, Socket } from "socket.io";
import httpServer from "./shared/utils/httpServer";
import config from "./shared/utils/config";
import log from "./shared/utils/log";

async function main() {
  if (!config.MONGODB_URI) throw new Error(".env var: MONGODB_URI is missing");
  log.info("Connecting to mongodb >>>>>>");

  await mongoose.connect(config.MONGODB_URI);
  log.info("Connected to mongodb successfully ✅");

  const io = new Server(httpServer, { cors: { origin: "*" } });

  io.on("connection", (socket: Socket) => {
    log.info(`New connection to socket ✅: ${socket.id}`);
    socket.on("response", (data) => socket.broadcast.emit("response", data));
  });

  httpServer.listen(8085, () => log.info("Server is running on port: 8085"));
}

main().catch((e) => log.error(e));
