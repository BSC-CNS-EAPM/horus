import { Socket } from "socket.io-client";

export default function getCommands(socket: Socket) {
  return {
    echo: {
      description: "Echo a passed string.",
      usage: "echo <string>",
      fn: (...args) => args.join(" "),
    },
    sendSocket: {
      description: "Send a message to the server.",
      usage: "sendSocket <string>",
      fn: (...args) => socket.emit("message", args.join(" ")),
    },
    sel: {
      description: "Focus a residue.",
      usage: "focus <residue>",
      fn: (...args) => {
        const [selection, surroundRadius] = args;
        const options = { surroundRadius: parseInt(surroundRadius) };
        const numberSel = parseInt(selection);
        const molstar = window.molstar;
        return molstar
          ? molstar.focusFirst(numberSel, options)
          : "Molstar is not defined.";
      },
    },
  };
}
