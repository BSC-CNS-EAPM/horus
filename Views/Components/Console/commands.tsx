import { horusPost } from "../../Utils/utils";
import HorusMolstar from "../Molstar/HorusWrapper/horusmolstar";
import { socket } from "../../Utils/socket";

declare global {
  interface Window {
    molstar?: HorusMolstar;
    selectedRemote?: string;
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
    molreset: {
      description: "Reset Mol* viewer",
      usage: "molreset",
      fn: (...args) => {
        const molstar = window.molstar;
        return molstar ? molstar.reset() : "Molstar is not defined.";
      },
    },
    focus: {
      description: "Focus a residue.",
      usage:
        "focus <structure label> -r <residueID> -c <chain> -s <surround radius>",
      fn: (...args) => {
        // The residue ID is the first argument (if provided)
        // The user can just type focus -r <residueID> and the residue ID will be the first argument
        let structureLabel = args[0];

        // Check that the structure label is not -r, -c or -s
        if (
          structureLabel === "-r" ||
          structureLabel === "-c" ||
          structureLabel === "-s"
        ) {
          // Then the user did not provide a structure label, and the first structure will be focused
          structureLabel = undefined;
        }

        // Parse the optional arguments
        const options = args.reduce((acc, arg, index) => {
          if (arg === "-r") {
            // The residue ID must be an integer
            try {
              acc.resID = parseInt(args[index + 1]);
            } catch (e) {
              return "The residue ID must be an integer.";
            }
          } else if (arg === "-c") {
            acc.chain = args[index + 1];
          } else if (arg === "-s") {
            // The surround radius must be an integer
            try {
              acc.surroundRadius = parseInt(args[index + 1]);
            } catch (e) {
              return "The surround radius must be an integer.";
            }
          }
          return acc;
        }, {});

        const molstar = window.molstar;
        return molstar
          ? molstar.focus(
              structureLabel,
              options.resID,
              options.chain,
              options.surroundRadius
            )
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
          const response = await horusPost(
            "/api/desktop/command",
            header,
            body
          );
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
        return result;
      },
    },
    listmol: {
      description: "List structures in Mol*.",
      usage: "listmol",
      fn: async (...args) => {
        const molstar = window.molstar;
        const strucList = molstar.listStructures();

        const names = strucList.map((struc) => struc.name);

        // Parse as a string with \n as a separator
        const strucListString = names.join("\n");
        return strucListString;
      },
    },
  };
}
