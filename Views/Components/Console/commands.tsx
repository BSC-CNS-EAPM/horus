import { horusPost } from "../../Utils/utils";
import HorusMolstar from "../Molstar/HorusWrapper/horusmolstar";
import { socket } from "../../Utils/socket";

declare global {
  interface Window {
    molstar?: HorusMolstar;
  }
}

export default function getCommands() {
  return {
    echo: {
      description: "Echo a passed string.",
      usage: "echo <string>",
      fn: (...args) => args.join(" "),
    },
    sendsocket: {
      description: "Send a message to the server.",
      usage: "sendsocket <string>",
      fn: (...args) => {
        socket.emit("message", "Hello from the client!");
      },
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
    os: {
      description: "Run an OS command. Only available on the desktop app.",
      usage: "os <command> <args>",
      fn: async (...args) => {
        const header = {
          "Content-Type": "application/json",
          Accept: "application/json",
        };
        const body = JSON.stringify({ command: args.join(" ") });
        try {
          const response = await horusPost("/desktop/command", header, body);
          const data = await response.json();

          if (data.ok) {
            return data.output;
          }

          return "Error running command: " + data.message;
        } catch (e) {
          return e.message;
        }
      },
    },
    newflow: {
      description: "Clear the flow and open a new one.",
      usage: "newflow",
      fn: async (...args) => {
        // Emit an event to clear the flow
        const event = new CustomEvent("terminalCommand", {
          detail: { command: "newflow", args: args },
        });

        const result = await window.dispatchEvent(event);
        return result;
      },
    },
    saveflow: {
      description: "Save the current flow.",
      usage: "saveflow",
      fn: async (...args) => {
        // Emit an event to save the flow
        const event = new CustomEvent("terminalCommand", {
          detail: { command: "saveflow", args: args },
        });

        const result = await window.dispatchEvent(event);
        return result;
      },
    },
    conn: {
      description: "Connects two blocks",
      usage: "conn <block1-placedid> <block2-placedid>",
      fn: async (...args) => {
        // Emit an event to connect two blocks
        const event = new CustomEvent("terminalCommand", {
          detail: { command: "conn", args: args },
        });

        const result = await window.dispatchEvent(event);
        return result;
      },
    },
    run: {
      description: "Execute the current flow.",
      usage: "run <starting-block-placedid>",
      fn: async (...args) => {
        // Emit an event to execute the flow
        const event = new CustomEvent("terminalCommand", {
          detail: { command: "run", args: args },
        });

        const result = await window.dispatchEvent(event);
        return result;
      },
    },
    del: {
      description: "Delete a block.",
      usage: "del <block-placedid>",
      fn: async (...args) => {
        // Emit an event to delete a block
        const event = new CustomEvent("terminalCommand", {
          detail: { command: "del", args: args },
        });

        const result = await window.dispatchEvent(event);
        console.log(result);
        return result;
      },
    },
  };
}
