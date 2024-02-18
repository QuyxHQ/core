import http from "http";
import createServer from "./app";

const app = createServer();

const httpServer = http.createServer(app);

export default httpServer;
