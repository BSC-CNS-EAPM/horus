import { io } from "socket.io-client";

// Create the socket
export const socket = io({
  autoConnect: true,
});
