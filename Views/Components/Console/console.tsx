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
import { StructureElement } from "molstar/lib/mol-model/structure";
import { StructureRepresentationRegistry } from "molstar/lib/mol-repr/structure/registry";
import { ColorListNames } from "molstar/lib/mol-util/color/lists";

type Command = {
  description: string;
  usage: string;
  fn: (...args: string[]) => Promise<string> | string;
};

const NO_MOLSTAR = "Molstar is not initialized";

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
            return "Molstar reset";
          } else {
            return NO_MOLSTAR;
          }
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
              return NO_MOLSTAR;
            }
            const molstar = window.molstar;
            return molstar.focus(
              structureLabel,
              options.resID,
              options.chain,
              options.surroundRadius,
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
          if (!isMolstarLoaded(window.molstar)) return NO_MOLSTAR;
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
          if (!isMolstarLoaded(window.molstar)) return NO_MOLSTAR;

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
      clearSelection: {
        description: "Clears the Mol* selection",
        usage: "clearSelection",
        fn: async () => {
          if (!isMolstarLoaded(window.molstar)) return NO_MOLSTAR;

          window.molstar.plugin?.managers.interactivity.lociSelects.deselectAll();

          return "Cleared selection";
        },
      },
      vmd: {
        description:
          "Perform VMD selections in Horus. Optionally provide a label to select only from that structure.",
        usage: "vmd [-l] <structure label> <script>",
        fn: async (...args: string[]) => {
          if (!isMolstarLoaded(window.molstar)) return NO_MOLSTAR;

          let label: string | undefined;
          let script: string;

          // If the first argument starts with '-l', the next arg is the label
          if (args[0] === "-l") {
            label = args[1];
            script = args.slice(2).join(" ");
          } else {
            label = undefined;
            script = args.join(" ");
          }

          const loci = await window.molstar.selectWithScript({
            label,
            script: script.replaceAll('"', ""),
            language: "vmd",
          });

          let count = 0;
          if (loci) {
            const residueLoci =
              StructureElement.Loci.extendToWholeResidues(loci);
            count = StructureElement.Loci.size(residueLoci);
          }

          return `Selected ${count} atoms`;
        },
      },
      create: {
        description:
          "Create a component for the selected structures. You can list the available representations with 'representations'",
        usage: "create [-l <label>] <representation> <color>",
        fn: async (...args: string[]) => {
          if (!isMolstarLoaded(window.molstar)) return NO_MOLSTAR;

          let label: string | undefined;
          let representation: string | undefined;
          let color: string | undefined;

          // Parse arguments
          if (args[0] === "-l") {
            if (args.length < 4) {
              return "Error: Usage is create -l <label> <representation> <color>";
            }
            label = args[1];
            representation = args[2];
            color = args[3];
          } else {
            if (args.length < 2) {
              return "Error: Usage is create <representation> <color>";
            }
            representation = args[0];
            color = args[1];
          }

          // Validate representation and color if needed here (optional)

          // Call the function with the parsed arguments
          await window.molstar.createComponentForSelection({
            label,
            representation:
              representation as StructureRepresentationRegistry.BuiltIn,
            color: color,
          });

          return "Component created";
        },
      },
      "remove-selected": {
        description: "Removes the selected components from the view",
        usage: "remove-selected",
        fn: async () => {
          if (!isMolstarLoaded(window.molstar)) return NO_MOLSTAR;

          const c = window.molstar.substractSelection();

          return `Removed elements from ${c} components`;
        },
      },
      representations: {
        description: "Shows avilable representations",
        usage: "representations",
        fn: async () => {
          const reprs = Object.keys(
            StructureRepresentationRegistry.BuiltIn,
          ).join("\n");

          return "==== Representations ====\n" + reprs;
        },
      },
      colors: {
        description: "Shows avilable colors",
        usage: "colors",
        fn: async () => {
          const colors = ColorListNames.join("\n");
          return "==== Colors ====\n" + colors;
        },
      },
      load: {
        description: "Loads a molecule file from a given path",
        usage: "load <path> -l [label] -r [representation] -c [color]",
        fn: async (...args: string[]) => {
          // if (!isMolstarLoaded(window.molstar)) return NO_MOLSTAR;

          // Helper function to parse command line arguments
          const parseArgs = (
            args: string[],
          ): {
            path: string | null;
            label: string | null;
            representation: string | null;
            color: string | null;
          } => {
            const result = {
              path: null as string | null,
              label: null as string | null,
              representation: null as string | null,
              color: null as string | null,
            };

            // First argument is always the path
            result.path = args[0] || null;

            // Parse flag-based arguments
            for (let i = 1; i < args.length; i++) {
              const arg = args[i];
              const nextArg = args[i + 1];

              switch (arg) {
                case "-l":
                  if (nextArg && !nextArg.startsWith("-")) {
                    result.label = nextArg;
                    i++; // Skip the next argument since we consumed it
                  }
                  break;
                case "-r":
                  if (nextArg && !nextArg.startsWith("-")) {
                    result.representation = nextArg;
                    i++; // Skip the next argument since we consumed it
                  }
                  break;
                case "-c":
                  if (nextArg && !nextArg.startsWith("-")) {
                    result.color = nextArg;
                    i++; // Skip the next argument since we consumed it
                  }
                  break;
              }
            }

            return result;
          };

          // Parse arguments
          const parsedArgs = parseArgs(args);
          const path = parsedArgs.path;
          const label = parsedArgs.label;
          const representation = parsedArgs.representation;
          const color = parsedArgs.color;

          if (!path) {
            return "Error: File path not provided.\nUsage: load <path> -l [label] -r [representation] -c [color]";
          }

          try {
            const blob = await window.horus.getFile(path);
            const filename = path.split("/").pop() || "molecule";
            const finalLabel = label ?? filename;
            const file = new File([blob], filename);

            // Build theme object conditionally
            const theme: any = {};

            if (color) {
              theme.colorParams = {
                value: color,
              };
            }

            if (representation) {
              theme.representation = representation;
            }

            await window.molstar?.loadMoleculeFile(file, {
              label: finalLabel,
              ...(Object.keys(theme).length > 0 && { theme }),
            });

            return `Loaded ${filename}${label ? ` as "${label}"` : ""}${representation ? ` with representation "${representation}"` : ""}${color ? ` and color "${color}"` : ""}`;
          } catch (err) {
            console.error("Error loading file:", err);
            return `Failed to load file from "${path}".`;
          }
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
