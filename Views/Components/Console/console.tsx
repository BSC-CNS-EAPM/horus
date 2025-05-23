// React
import { createRef, useContext, useEffect } from "react";

// Horus web-server
import { socket } from "../../Utils/socket";

// Terminal component
// @ts-ignore
import Terminal from "react-console-emulator";

// Terminal commands
import { DockContext, PANEL_REGISTRY, togglePanel } from "../MainApp/PanelView";
import { isMolstarLoaded } from "../Molstar/HorusWrapper/horusmolstar";

type Command = {
  description: string;
  usage: string;
  fn: (...args: string[]) => Promise<string> | string;
};

export default function HorusTerm() {
  // use the dock context to manage panels
  const { dockApi } = useContext(DockContext);

  // Create a ref to the Terminal and assign the Terminal type
  const term = createRef<Terminal>();

  const getCommands: Record<string, Command> = (() => {
    return {
      help: {
        description: "List all available commands.",
        usage: "help",
        fn: () => {
          const commands: Command[] = Object.values(getCommands);
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
          term.current?.clearStdout();

          // Re focus the terminal
          term.current?.focusTerminal();

          // Scroll to the bottom of the terminal
          term.current?.scrollToBottom();
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
          togglePanel({
            dockApi: dockApi,
            component: PANEL_REGISTRY.terminal.component,
            panelID: PANEL_REGISTRY.terminal.id,
          });
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
          if (isMolstarLoaded(window.molstar)) {
            window?.molstar?.reset();
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
            if (!isMolstarLoaded(window.molstar)) {
              return "Molstar is not defined.";
            }
            const molstar = window.molstar;
            return molstar.focus(
              structureLabel,
              options.resID,
              options.chain,
              options.surroundRadius
            );
          } catch (e: any) {
            return "Internal error focusing residue: " + e.message;
          }
        },
      },
      listmol: {
        description: "List structures in Mol*.",
        usage: "listmol",
        fn: async () => {
          if (!isMolstarLoaded(window.molstar)) return "Molstar not loaded";
          const molstar = window.molstar;
          const strucList = molstar?.listStructures() ?? [];

          if (strucList.length === 0) {
            return "No structures found";
          }

          const names = strucList.map((struc) => struc.label);

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
          const structureLabel = args[0];
          if (!isMolstarLoaded(window.molstar))
            return "Molstar is not initialized";

          const molstar = window.molstar;
          const chainList = molstar?.listChains(structureLabel) ?? [];

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
              return `${chain.label}: ${chain.chainID}`;
            })
            .join("\n");
          return chainsString;
        },
      },
    };
  })();

  useEffect(() => {
    const printTerm = (data: string | Buffer) => {
      // Always convert to string
      data = data.toString();

      // Push the data to the terminal
      term.current?.pushToStdout(data);

      // Scroll to the bottom of the terminal
      term.current?.scrollToBottom();
    };

    // When recieving a message from the server, log it to the console
    socket.on("printTerm", printTerm);

    return () => {
      socket.off("printTerm", printTerm);
    };
  }, [term]);

  return (
    <Terminal
      commands={getCommands}
      promptLabel={"horus:~$ "}
      ref={term}
      style={{
        borderRadius: "0px",
        height: "100%",
      }}
      disableOnProcess
      noDefaults
      autoFocus
    />
  );
}
