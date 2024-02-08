type Command = {
  description: string;
  usage: string;
  fn: (...args: string[]) => Promise<string> | string;
};

export default function getCommands(): {
  [key: string]: Command;
} {
  return {
    help: {
      description: "List all available commands.",
      usage: "help",
      fn: () => {
        const commands: Command[] = Object.values(getCommands());
        const commandsString = commands
          .map((command) => {
            return `${command.usage}: ${command.description}`;
          })
          .join("\n");
        return commandsString;
      },
    },
    clear: {
      description: "Clear the console and the flow console output.",
      usage: "clear",
      fn: () => {
        // Clear the terminal and the stored messages
        window.horusTerm.ref?.current?.clearStdout();
        window.horusTerm.storedMessages = [];

        // Re focus the terminal
        window.horusTerm.ref?.current?.focusTerminal();

        // Scroll to the bottom of the terminal
        window.horusTerm.ref?.current?.scrollToBottom();
        return "";
      },
    },
    echo: {
      description: "Echo a passed string.",
      usage: "echo <string>",
      fn: (...args: string[]) => args.join(" "),
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
    //   fn: (...args : string[]) => {
    //     socket.emit("message", "Hello from the client!");
    //   },
    // },
    molreset: {
      description: "Reset Mol* viewer",
      usage: "molreset",
      fn: () => {
        if (window.molstar) {
          window.molstar.reset();
        }
        return "";
      },
    },
    focus: {
      description: "Focus a residue.",
      usage:
        "focus <structure label> -r <residueID> -c <chain> -s <surround radius>",
      fn: (...args: string[]) => {
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
        const options = args.reduce((acc: any, arg, index) => {
          if (arg === "-r") {
            // The residue ID must be an integer
            try {
              acc.resID = parseInt(args[index + 1]!);
            } catch (e) {
              return "The residue ID must be an integer.";
            }
          } else if (arg === "-c") {
            acc.chain = args[index + 1];
          } else if (arg === "-s") {
            // The surround radius must be an integer
            try {
              acc.surroundRadius = parseInt(args[index + 1]!);
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
        } catch (e: any) {
          return "Internal error focusing residue: " + e.message;
        }
      },
    },
    listmol: {
      description: "List structures in Mol*.",
      usage: "listmol",
      fn: async () => {
        const molstar = window.molstar;
        const strucList = molstar.listStructures();

        if (strucList.length === 0) {
          return "No structures found";
        }

        const names = strucList.map((struc) => struc.name);

        // Parse as a string with \n as a separator
        const strucListString = names.join("\n");
        return strucListString;
      },
    },
    listchains: {
      description: "List chains in Mol*.",
      usage: "listchains <structure label>",
      fn: async (...args: string[]) => {
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
