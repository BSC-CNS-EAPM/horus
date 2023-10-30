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
