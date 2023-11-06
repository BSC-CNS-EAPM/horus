import { io } from "socket.io-client";

declare global {
  interface Window {
    socketiosid: string;
  }
}

// Create the socket
export const socket = io({
  autoConnect: true,
});

// When connected, store the sid into the window
socket.on("connect", () => {
  window.socketiosid = socket.id;
});

// When disconnected, remove the sid from the window
socket.on("disconnect", () => {
  delete window.socketiosid;
});

