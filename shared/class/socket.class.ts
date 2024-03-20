import { io, Socket as SocketIO } from "socket.io-client";
import log from "../utils/log";

class Socket {
  private socket: SocketIO;

  constructor() {
    this.socket = io();

    this.socket.on("connection", () => log.info("Connected 🔌"));
    this.socket.on("disconnect", () => log.info("Disconnected ❌"));
  }

  emit = (data: { [key: string]: any }) => this.socket.emit("response", data);

  close = () => (this.socket.connected ? this.socket.disconnect() : false);
}

export default Socket;
