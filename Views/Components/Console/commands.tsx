import HorusMolstar from "../Molstar/HorusWrapper/horusmolstar";
import Terminal from "react-console-emulator";

declare global {
  interface Window {
    molstar?: HorusMolstar;
    selectedRemote?: string;
    horusTerm: {
      ref: React.RefObject<Terminal>;
      storedMessages: string[];
    };
  }
}

export default function getCommands() {
  return {
    clear: {
      description: "Clear the console and the flow console output.",
      usage: "clear",
      fn: () => {
        // Clear the terminal and the stored messages
        window.horusTerm.ref.current?.clearStdout();
        window.horusTerm.storedMessages = [];

        // Re focus the terminal
        window.horusTerm.ref.current?.focusTerminal();

        // Scroll to the bottom of the terminal
        window.horusTerm.ref.current?.scrollToBottom();
        return "";
      },
    },
    echo: {
      description: "Echo a passed string.",
      usage: "echo <string>",
      fn: (...args) => args.join(" "),
    },
    exit: {
      description: "Exit the terminal.",
      usage: "exit",
      fn: () => {
        // Emit a toggleConsole event
        const event = new CustomEvent("toggleConsole");
        window.dispatchEvent(event);
        return "";
      },
    },
    // sendsocket: {
    //   description: "Send a message to the server.",
    //   usage: "sendsocket <string>",
    //   fn: (...args) => {
    //     socket.emit("message", "Hello from the client!");
    //   },
    // },
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

        try {
          const molstar = window.molstar;
          return molstar
            ? molstar.focus(
                structureLabel,
                options.resID,
                options.chain,
                options.surroundRadius
              )
            : "Molstar is not defined.";
        } catch (e) {
          return "Internal error focusing residue: " + e.message;
        }
      },
    },
    // os: {
    //   description: "Run an OS command. Only available on the desktop app.",
    //   usage: "os <command> <args>",
    //   fn: async (...args) => {
    //     const header = {
    //       "Content-Type": "application/json",
    //       Accept: "application/json",
    //     };
    //     const body = JSON.stringify({ command: args.join(" ") });
    //     try {
    //       const response = await horusPost(
    //         "/api/desktop/command",
    //         header,
    //         body
    //       );
    //       const data = await response.json();

    //       if (data.ok) {
    //         return data.output;
    //       }

    //       return "Error running command: " + data.message;
    //     } catch (e) {
    //       return e.message;
    //     }
    //   },
    // },
    // newflow: {
    //   description: "Clear the flow and open a new one.",
    //   usage: "newflow",
    //   fn: async (...args) => {
    //     // Emit an event to clear the flow
    //     const event = new CustomEvent("terminalCommand", {
    //       detail: { command: "newflow", args: args },
    //     });

    //     const result = await window.dispatchEvent(event);
    //     return result;
    //   },
    // },
    // saveflow: {
    //   description: "Save the current flow.",
    //   usage: "saveflow",
    //   fn: async (...args) => {
    //     // Emit an event to save the flow
    //     const event = new CustomEvent("terminalCommand", {
    //       detail: { command: "saveflow", args: args },
    //     });

    //     const result = await window.dispatchEvent(event);
    //     return result;
    //   },
    // },
    // conn: {
    //   description: "Connects two blocks",
    //   usage: "conn <block1-placedid> <block2-placedid>",
    //   fn: async (...args) => {
    //     // Emit an event to connect two blocks
    //     const event = new CustomEvent("terminalCommand", {
    //       detail: { command: "conn", args: args },
    //     });

    //     const result = await window.dispatchEvent(event);
    //     return result;
    //   },
    // },
    // run: {
    //   description: "Execute the current flow.",
    //   usage: "run <starting-block-placedid>",
    //   fn: async (...args) => {
    //     // Emit an event to execute the flow
    //     const event = new CustomEvent("terminalCommand", {
    //       detail: { command: "run", args: args },
    //     });

    //     const result = await window.dispatchEvent(event);
    //     return result;
    //   },
    // },
    // del: {
    //   description: "Delete a block.",
    //   usage: "del <block-placedid>",
    //   fn: async (...args) => {
    //     // Emit an event to delete a block
    //     const event = new CustomEvent("terminalCommand", {
    //       detail: { command: "del", args: args },
    //     });

    //     const result = await window.dispatchEvent(event);
    //     return result;
    //   },
    // },
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
    listchains: {
      description: "List chains in Mol*.",
      usage:
        "List all chains: listchains. List chains in a structure: listchains <structure label>",
      fn: async (...args) => {
        // The structure label is the first argument (if provided)
        // The user can just type listchains <structure label> and the structure label will be the first argument
        let structureLabel = args[0];

        const molstar = window.molstar;
        const chainList = molstar.listChains(structureLabel);

        if (!chainList || chainList.length === 0) {
          if (structureLabel) {
            return `No chains found in ${structureLabel}`;
          } else {
            return "No chains found";
          }
        }

        // Parse as a string with \n as a separator
        const chainsString = chainList
          .map((chain) => {
            return `${chain.strucutre_label}: ${chain.chainID}`;
          })
          .join("\n");
        return chainsString;
      },
    },
  };
}
