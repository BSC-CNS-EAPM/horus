import { io } from "socket.io-client";

// Create the socket
export const socket = io({
  autoConnect: true,
});

// When connected, store the sid into the window
socket.on("connect", () => {
  window.socketiosid = socket.id ?? null;
});

// When disconnected, remove the sid from the window
socket.on("disconnect", () => {
  window.socketiosid = null;
});
