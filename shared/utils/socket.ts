import Socket from "../class/socket.class";

export const broadcastEvent = (data: { [key: string]: any }) => {
  const socketInstance = new Socket();

  socketInstance.emit(data);
  socketInstance.close();
};
