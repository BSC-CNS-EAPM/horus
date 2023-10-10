import { BlockView, DraggableBlockView } from "./block_view";
import { useEffect, useRef, useState } from "react";
import { horusGet, horusPost } from "../../Utils/utils";
import RotatingLines from "../RotatingLines/rotatinglines";
import { useDroppable } from "@dnd-kit/core";
import { Xwrapper } from "react-xarrows";
import {
  VariableConnectionArrow,
  BlockConnectionArrow,
} from "./arrow_connector";
import { debounce } from "../reusable";
import { Block, BlockVarPair, PluginVariableTypes } from "./flow_builder_types";
import FlowExecuter from "./flow_executer";
import { FlowBuilderController } from "./flow_builder_hooks";
import { ServerFileExplorerModal } from "../FileExplorer/file_explorer";

// Define the selectedRemote on the window object
declare global {
  interface Window {
    selectedRemote?: string;
  }
}

type FlowReciverProps = {
  flowName: string;
  placedBlocks: Block[];
  savedID?: string;
  flowPath?: string;
  currentSaved: React.MutableRefObject<boolean>;
  placedIDCounter: React.MutableRefObject<number>;
  flowBuilderController: FlowBuilderController;

  setPlacedBlocks: React.Dispatch<React.SetStateAction<Array<Block>>>;
  setSaved: (saved: boolean) => void;
  unconnectBlocks: (currentBlock: Block, connectedBlock: Block) => void;
  unconnectVariables: (connection: {
    origin: BlockVarPair;
    destination: BlockVarPair;
  }) => void;

  isConnecting: boolean;
  tryingToConnect: {
    variableID: string;
    variableType: PluginVariableTypes;
    variableAllowedValues: Array<string>;
  };
};

function FlowReciver(props: FlowReciverProps) {
  // Modal state
  const [flowName, setFlowName] = useState("New flow");

  // Saved flow vars
  const savedID = useRef(props.savedID ? props.savedID : "new_flow");
  const flowPath = useRef(props.flowPath || "");
  const { currentSaved, setSaved } = props;

  // Executing state
  const [executingAll, setExecutingAll] = useState(false);
  const [currentExecuting, setCurrentExecuting] = useState<number | null>(null);

  // Selected cluster
  const [remotesOptions, setRemotesOptions] = useState<string[]>([]);
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectRemote = async () => {
    setIsConnecting(true);
    setRemoteConnected(false);
    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify({
      remote: selectedRemote,
    });

    const response = await horusPost("/remotes/connect", header, body);
    const data = await response.json();

    if (!data.ok) {
      alert(data.msg);
      setRemoteConnected(false);
    } else {
      setRemoteConnected(true);
    }

    setIsConnecting(false);
  };

  useEffect(() => {
    if (selectedRemote) {
      connectRemote();
      // Set the selected remote to the global window variable
      window.selectedRemote = selectedRemote;
    }
  }, [selectedRemote]);

  const { setNodeRef } = useDroppable({
    id: "flow-reciver",
  });

  const handleSaveAs = async () => {
    const oldSavedID = savedID.current;
    const oldFlowPath = flowPath.current;
    savedID.current = "new_flow";
    flowPath.current = "";
    await preHandleSave();
    if (savedID.current === "new_flow") {
      savedID.current = oldSavedID;
      flowPath.current = oldFlowPath;
    }
  };

  const debouncedHandleSaveAs = debounce(handleSaveAs, 1000);

  const currentSaving = useRef(false);

  const handleSave = async () => {
    if (currentSaving.current) {
      return;
    }

    currentSaving.current = true;

    const molstarState = await window.molstar?.snapshot.get();
    const saveContents = {
      name: flowName,
      blocks: props.placedBlocks,
      savedID: savedID.current,
      path: flowPath.current,
      remote: selectedRemote,
      currentExecuting: flowExecuter.current.currentExecuting,
      molstarState: molstarState,
      terminalOutput: window.horusTerm.storedMessages,
    };

    const body = JSON.stringify(saveContents);

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const response = await horusPost("/saveflow", headers, body);
    var savedFlow = await response.json();

    currentSaving.current = false;

    if (!savedFlow.ok) {
      alert(savedFlow.error);
      return;
    }

    const overwrite = savedFlow.overwrite;
    const existingName = savedFlow.existingName;
    const path = overwrite ? savedFlow.path : flowPath.current;
    const desktop = savedFlow.desktop;

    if (
      overwrite &&
      !desktop &&
      !confirm(
        "Flow with the same name already exists. Are you sure you want to overwrite the flow?"
      )
    ) {
      return;
    }

    if (overwrite) {
      const overwriteContents = {
        ...saveContents,
        name: existingName,
        path: path,
        overwrite: true,
      };
      const overwriteBody = JSON.stringify(overwriteContents);

      const overwriteResponse = await horusPost(
        "/saveflow",
        headers,
        overwriteBody
      );
      savedFlow = await overwriteResponse.json();

      if (!savedFlow.ok) {
        alert(savedFlow.error);
        return;
      }
    }
    setSaved(true);
    // setFlowName(savedFlow.name);
    savedID.current = savedFlow.savedID;
    flowPath.current = savedFlow.path;
  };

  const updateBlockSelectedGroup = (
    placedID: number,
    selectedInputGroup: string
  ) => {
    // Search in the placed blocks for the block with the given palced ID

    // Update the placedBlocks array
    props.setPlacedBlocks((currentBlocks) => {
      return currentBlocks.map((b) => {
        if (b.placedID === placedID) {
          b.selectedInputGroup = selectedInputGroup;
        }
        return b;
      });
    });
  };

  const flowExecuter = useRef(
    new FlowExecuter(
      setCurrentExecuting,
      props.setPlacedBlocks,
      setExecutingAll,
      handleSave
    )
  );

  const executeBlock = async (block: Block): Promise<void> => {
    setExecutingAll(true);

    // Check that the flow is saved
    if (!currentSaved.current) {
      // Save the flow
      await handleSave();
    }

    // // Set blocks as not executed
    // props.setPlacedBlocks(
    //   props.placedBlocks.map((b) => {
    //     b.finishedExecution = false;
    //     return b;
    //   })
    // );

    // Update the placedBlocks in the FlowExecuter
    flowExecuter.current.updatePlacedBlocks(props.placedBlocks);
    flowExecuter.current.updateFlowPath(flowPath.current);
    flowExecuter.current.setSavedID(savedID.current);

    // Set the running spinner for the current block
    flowExecuter.current.stopExecute = false;
    const executed = await flowExecuter.current.executeBlock(
      block.placedID,
      true
    );

    // Check any error status code
    executed === true ? toggleError(block, false) : toggleError(block);

    // Update the placedBlocks in the view
    props.setPlacedBlocks(flowExecuter.current.placedBlocks);

    flowExecuter.current.stopExecute = false;

    setExecutingAll(false);

    // If there is a block still running, set executingAll to true
    for (const block of flowExecuter.current.placedBlocks) {
      if (block.isRunning) {
        setExecutingAll(true);
        break;
      }
    }

    await handleSave();
  };

  const checkRemoteBlock = async (block: Block): Promise<void> => {
    flowExecuter.current.checkRemoteBlock(block);
  };

  function toggleSpinner(block: Block, status: boolean = true) {
    props.setPlacedBlocks(
      props.placedBlocks.map((b) => {
        if (b.placedID === block.placedID) {
          b.isRunning = status;
        }
        return b;
      })
    );
  }

  function toggleError(block: Block, status: boolean = true) {
    props.setPlacedBlocks(
      props.placedBlocks.map((b) => {
        if (b.placedID === block.placedID) {
          b.runError = status;
        }
        return b;
      })
    );
  }

  const stopExecutingAll = async () => {
    if (!executingAll) {
      return;
    }

    if (!confirm("Are you sure you want to stop executing the flow?")) {
      return;
    }

    setExecutingAll(false);

    flowExecuter.current.stopExecute = true;
  };

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFlowName(e.target.value);
    setSaved(false);
  };

  const handleDelete = (block: Block) => {
    let updatedPlacedBlocks = props.placedBlocks;

    // Delete the connections to this block in
    // the connected blocks REFERENCE of the block to delete
    if (block.connectedToReference && block.connectedToReference.length > 0) {
      for (const connected of block.connectedToReference) {
        // Find in the placedBlocks the connected block
        const realConnected = updatedPlacedBlocks.find(
          (b) => b.placedID === connected
        );

        // Remove the reference to the block to delete
        realConnected.connectedTo = realConnected.connectedTo.filter(
          (b) => b !== block.placedID
        );

        // Update the placedBlocks array
        updatedPlacedBlocks = updatedPlacedBlocks.map((b) => {
          if (b.placedID === realConnected.placedID) {
            b.connectedTo = realConnected.connectedTo;
          }
          return b;
        });
      }
    }

    // Delete the connection REFERENCE in the connected
    // blocks of the block to delete
    if (block.connectedTo && block.connectedTo.length > 0) {
      for (const connected of block.connectedTo) {
        // Find in the placedBlocks the connected block
        const realConnected = updatedPlacedBlocks.find(
          (b) => b.placedID === connected
        );

        // Remove the reference to the block to delete
        realConnected.connectedToReference =
          realConnected.connectedToReference.filter(
            (b) => b !== block.placedID
          );

        // Update the placedBlocks array
        updatedPlacedBlocks = updatedPlacedBlocks.map((b) => {
          if (b.placedID === realConnected.placedID) {
            b.connectedToReference = realConnected.connectedToReference;
          }
          return b;
        });

        // Update the placedBlocks array
        updatedPlacedBlocks = updatedPlacedBlocks.map((b) => {
          if (b.placedID === realConnected.placedID) {
            b.connectedToReference = realConnected.connectedToReference;
          }
          return b;
        });
      }
    }

    // Delete the variable connections
    // going out from this block to
    // the connected blocks. For example,
    // this is an input block connected to an action
    // block. The action block is who stores the connection,
    // Therefore if we delete the input block, the connection
    // needs to be removed from the action block. Luckily,
    // when connecting variables, a reference to the connection
    // is istored in the input block. Therefore, we can use that
    // reference to find the real block and remove the connections
    // that depend on this block
    if (
      block.variableConnectionsReference &&
      block.variableConnectionsReference.length > 0
    ) {
      for (const varConnected of block.variableConnectionsReference) {
        // Find the real block from where the variable goes to
        const realBlock = updatedPlacedBlocks.find(
          (b) => b.placedID === varConnected.destination.placedID
        );

        if (!realBlock) {
          // console.log(
          //   "Error deleting variables: realBlock not found. Searched for ID: ",
          //   varConnected.destination.placedID
          // );
          continue;
        }

        // Remove from the real block the variable connection
        realBlock.variableConnections = realBlock.variableConnections.filter(
          (v) => v.origin.placedID !== block.placedID
        );

        // Update the placedBlocks array
        updatedPlacedBlocks = updatedPlacedBlocks.map((b) => {
          if (b.placedID === realBlock.placedID) {
            b.variableConnections = realBlock.variableConnections;
          }
          return b;
        });
      }
    }

    // If the block to be deleted is the action block for example,
    // the reference of the connection stored in the input block
    // needs to be removed. Therefore we need to read the block connections
    // and remove the reference to this connection in the input block
    if (block.variableConnections && block.variableConnections.length > 0) {
      for (const varConnected of block.variableConnections) {
        // Find the real block from where the variable comes from
        const realBlock = updatedPlacedBlocks.find(
          (b) => b.placedID === varConnected.origin.placedID
        );

        // Remove from the real block the variable connection reference
        realBlock.variableConnectionsReference =
          realBlock.variableConnectionsReference.filter(
            (v) => v.origin.placedID !== block.placedID
          );

        // Update the placedBlocks array
        updatedPlacedBlocks = updatedPlacedBlocks.map((b) => {
          if (b.placedID === realBlock.placedID) {
            b.variableConnectionsReference =
              realBlock.variableConnectionsReference;
          }
          return b;
        });
      }
    }

    // Delete the block
    updatedPlacedBlocks = props.placedBlocks.filter(
      (b) => b.placedID !== block.placedID
    );

    // Update the placedBlocks array
    props.setPlacedBlocks(updatedPlacedBlocks);

    setSaved(false);
  };

  const onBlockChange = (blockPlacedID: number) => {
    // Update the finishedExecution status
    // Update the placedBlocks array
    props.setPlacedBlocks((currentBlocks) => {
      return currentBlocks.map((b) => {
        if (b.placedID === blockPlacedID) {
          b.finishedExecution = false;
        }
        return b;
      });
    });
    setSaved(false);
  };

  const openingFlow = useRef(false);

  const [testSavedInternal, setTestSavedInternal] = useState(false);

  const [serverFilePickerOpen, setServerFilePickerOpen] = useState(false);
  const [serverFolderPickerOpen, setServerFolderPickerOpen] = useState(false);

  const loadFlow = async (
    openRecent: {
      savedID: string;
      path: string;
    } = null
  ) => {
    if (openingFlow.current) {
      return;
    }
    openingFlow.current = true;

    if (!currentSaved.current) {
      if (
        !confirm(
          "Current flow is not saved. Are you sure you want to open a new one?"
        )
      ) {
        openingFlow.current = false;
        return;
      }
    }

    let data = {
      ok: false,
      flow: null,
      error: "Early error opening flow",
    };
    let isDefaultFlow = false;
    if (openRecent !== null) {
      const header = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (openRecent.path === undefined) {
        isDefaultFlow = true;
      }

      const body = JSON.stringify({
        savedID: openRecent.savedID,
        path: openRecent.path,
      });
      const response = await horusPost("/openRecentFlow", header, body);

      data = await response.json();
    } else {
      const response = await horusGet("/openflow");
      data = await response.json();
    }

    if (!data.ok) {
      alert(data.error);
      openingFlow.current = false;
      return;
    }

    const openedFlow = data.flow;

    if (!openedFlow) {
      openingFlow.current = false;
      return;
    }

    // Set the molstar state at the beggining in case blocks need structures
    if (window.molstar && openedFlow.molstarState) {
      await window.molstar.snapshot.set(openedFlow.molstarState);
    }

    // Set the flow name
    setFlowName(openedFlow.name);
    savedID.current = openedFlow.savedID;
    flowPath.current = openedFlow.path;
    flowExecuter.current.setSavedID(savedID.current);
    flowExecuter.current.updatePlacedBlocks(openedFlow.blocks);
    flowExecuter.current.updateFlowPath(flowPath.current);

    // Set the terminal output
    window.horusTerm.storedMessages = openedFlow.terminalOutput;

    // Print all stored messages if the terminal is mounted
    window.horusTerm.ref?.current?.pushToStdout(
      window.horusTerm.storedMessages
        ? window.horusTerm.storedMessages.join("\n")
        : ""
    );

    // If any of the blocks is runnign set executingAll to true
    for (const block of openedFlow.blocks) {
      if (block.placedID === openedFlow.currentExecuting) {
        setExecutingAll(true);
        break;
      }
    }

    // Parse the blocks
    // const parsedBlocks =
    //   await props.flowBuilderController.parseBlocksFromOpenedFlow(
    //     openedFlow.blocks
    //   );
    props.setPlacedBlocks(openedFlow.blocks);

    // Set the selected remote
    setSelectedRemote(openedFlow.remote);

    // Set the placedIDCounter
    // Search for the highest placedID in the blocks and subblocks
    const placedIDs = openedFlow.blocks.map((b) => b.placedID);
    for (const block of openedFlow.blocks) {
      if (block.placedSubBlocks?.length > 0) {
        for (const subBlock of block.placedSubBlocks) {
          placedIDs.push(subBlock.placedID);
        }
      }
    }
    props.placedIDCounter.current = Math.max(...placedIDs) + 1;

    // Set the current executing block
    setCurrentExecuting(openedFlow.currentExecuting);

    // Set the saved state
    setSaved(!isDefaultFlow);
    // setTestSavedInternal(!isDefaultFlow);

    // console.log("Setting currentsaved to true");
    // currentSaved.current = true;

    openingFlow.current = false;
  };

  const handlingNew = useRef(false);

  const handleNew = (bypass: boolean = false) => {
    if (handlingNew.current) {
      return;
    }

    handlingNew.current = true;

    if (!currentSaved.current && !bypass) {
      if (
        !confirm(
          "Current flow is not saved. Are you sure you want to create a new flow?"
        )
      ) {
        handlingNew.current = false;
        return;
      }
    }
    setFlowName("New Flow");
    savedID.current = "new_flow";
    flowPath.current = "";
    props.setPlacedBlocks([]);
    props.placedIDCounter.current = 1;
    setSaved(true);
    resetHistory();
    handlingNew.current = false;

    // Clear the terminal if present
    if (window.horusTerm.ref && window.horusTerm.ref.current) {
      window.horusTerm.ref.current.clearStdout();
    }
    window.horusTerm.storedMessages = [];
  };

  const handleTerminalCommand = (e: CustomEvent) => {
    const command = e.detail.command;
    const args = e.detail.args;

    if (command === "newflow") {
      if (args[0] === "-y") {
        handleNew(true);
      } else {
        handleNew();
      }
      return "Flow cleared";
    }

    if (command === "openflow") {
      loadFlow();
      return "Flow loaded";
    }

    if (command === "saveflow") {
      handleSave();
      return "Flow saved";
    }

    if (command === "del") {
      if (args[0] !== undefined) {
        // Get the block by the placedID
        const block = props.placedBlocks.find(
          (b) => b.placedID === parseInt(args[0])
        );

        if (!block) {
          return "Block not found";
        }
        handleDelete(block);
      }
      return "Block deleted";
    }

    if (command === "conn") {
      if (args[0] !== undefined && args[1] !== undefined) {
        // Find the block by the placedID
        const block1 = props.placedBlocks.find(
          (b) => b.placedID === parseInt(args[0])
        );

        if (!block1) {
          return "Block not found";
        }

        // Find the block by the placedID
        const block2 = props.placedBlocks.find(
          (b) => b.placedID === parseInt(args[1])
        );

        if (!block2) {
          return "Block not found";
        }

        // connectArrowBlock(props.setPlacedBlocks, block1, block2);
        return "Command not implemented yet";
      }
    }

    if (command === "run") {
      if (args[0] !== undefined) {
        // Get the block by the placedID
        const block = props.placedBlocks.find(
          (b) => b.placedID === parseInt(args[0])
        );
        if (!block) {
          return "Block not found";
        }
        executeBlock(block);
      }
      return "Flow executed";
    }

    return "Command executed";
  };

  const fetchRemotes = async () => {
    const response = await horusGet("/remotes/names");
    const data = await response.json();

    if (!data.ok) {
      alert(data.error);
      return;
    }

    setRemotesOptions(data.remotes);

    if (selectedRemote === null) {
      setSelectedRemote("Local");
    }
  };

  useEffect(() => {
    // Fetch remotes
    fetchRemotes();
  }, []);

  const handleOpenFlow = (
    e: CustomEvent<{ savedID: string; path: string }>
  ) => {
    const hasPath = e.detail.path !== undefined;
    const hasSavedID = e.detail.savedID !== undefined;
    if (!window.isDesktop && !hasPath && !hasSavedID) {
      setServerFilePickerOpen(true);
    } else {
      loadFlow(Object.keys(e.detail).length === 0 ? null : e.detail);
    }
  };

  // For the server mode, we need to open first the file picker in folder mode
  // to select the saving folder
  const preHandleSave = async () => {
    if (
      !window.isDesktop &&
      (flowPath.current === "" || flowPath.current === null)
    ) {
      // Open the file picker
      setServerFolderPickerOpen(true);
      return;
    }

    await handleSave();
  };

  const debounceHandleSave = debounce(preHandleSave, 1000);

  useEffect(() => {
    // Add an event listener to clear all the state when the "New" button is clicked in the toolbar
    window.addEventListener("newFlow", (e) => {
      handleNew();
    });

    // Add an event listener to load a flow when the "Open" button is clicked in the toolbar
    window.addEventListener("openFlow", handleOpenFlow);

    // Add an event listener to save a flow when the "Save" button is clicked in the toolbar
    window.addEventListener("saveFlow", debounceHandleSave);

    // Add an event listener to save a flow when the "Save As.." button is clicked in the toolbar
    window.addEventListener("saveFlowAs", debouncedHandleSaveAs);

    // Add an event listener for the terminal commands
    window.addEventListener("terminalCommand", handleTerminalCommand);

    // Add an event listener for the center view button
    window.addEventListener("centerView", centerView);

    // Clean the event listener when the component is unmounted
    return () => {
      window.removeEventListener("newFlow", (e) => {
        handleNew();
      });
      window.removeEventListener("openFlow", handleOpenFlow);
      window.removeEventListener("saveFlow", debounceHandleSave);
      window.removeEventListener("saveFlowAs", debouncedHandleSaveAs);
      window.removeEventListener("terminalCommand", handleTerminalCommand);
      window.removeEventListener("centerView", centerView);
    };
  }, [props.placedBlocks, flowName, selectedRemote, currentExecuting]);

  const [showRemotes, setShowRemotes] = useState(false);

  const topBarTitle = () => {
    return (
      <div className="flex flex-row top-bar-flow-reciver flow-title">
        <input
          style={{
            // Set the border color to red if the flow is not saved
            borderColor: currentSaved.current ? "black" : "orange",
          }}
          className="flow-name"
          type="text"
          id="flow-name"
          placeholder={props.flowName}
          onChange={onNameChange}
          value={flowName}
        />
        {/* <button onClick={handleSave} className="flow-button">
      {currentSaved.current ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="var(--light-orange)"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m8.25 3v6.75m0 0l-3-3m3 3l3-3M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
          />
        </svg>
      )}
    </button> */}
        <div className="flex flex-col gap-0 items-center text-center">
          <button
            onClick={stopExecutingAll}
            className="flow-button"
            style={{
              cursor: executingAll ? "pointer" : "default",
            }}
          >
            {executingAll ? (
              <RotatingLines
              // strokeColor="grey"
              // strokeWidth="5"
              // animationDuration="0.75"
              // width="40"
              />
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill={
                  isConnecting
                    ? "var(--light-orange)"
                    : remoteConnected
                    ? "var(--light-green)"
                    : "var(--light-red)"
                }
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                onClick={() => {
                  !remoteConnected && connectRemote();
                }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z"
                />
              </svg>
            )}
          </button>
          <div
            style={{
              fontSize: "small",
              cursor: "context-menu",
            }}
            onClick={(e) => {
              fetchRemotes();
              setShowRemotes(!showRemotes);
            }}
          >
            {selectedRemote}
          </div>
        </div>
        {
          <ContextMenuRemotes
            remotes={remotesOptions}
            setSelectedRemote={setSelectedRemote}
            show={showRemotes}
            setShow={setShowRemotes}
          />
        }
      </div>
    );
  };

  const renderBlock = (block: Block, index: number) => {
    const connectedVars = block.variableConnections?.map((connection) => {
      return VariableConnectionArrow({
        connection: connection,
        unconnectVariables: props.unconnectVariables,
        isSecond: connection.isCyclic,
        cycleNumber: connection.cycles,
      });
    });

    const connectedBlocks = block.connectedTo?.map((connection) => {
      return BlockConnectionArrow({
        currentBlock: block,
        connectedBlock: props.placedBlocks.find(
          (b) => b.placedID === connection
        ),
        unconnectBlocks: props.unconnectBlocks,
      });
    });

    const blockToRender = {
      ...block,
      onChange: onBlockChange,
      execute: executeBlock,
      // // index={index}
      deleteBlock: handleDelete,
      isRunning: block.placedID === currentExecuting,
      checkRemoteStatus: checkRemoteBlock,
    };

    return (
      <>
        <DraggableBlockView
          key={`${block.placedID}-${block.id}`}
          block={blockToRender}
          updateBlockSelectedGroup={updateBlockSelectedGroup}
          isConnecting={props.isConnecting}
          tryingToConnect={props.tryingToConnect}
        />
        {connectedVars}
        {connectedBlocks}
      </>
    );
  };

  const placedBlocksView = props.placedBlocks.map(renderBlock);

  const [isPanning, setIsPanning] = useState(false);

  const [past, setPast] = useState<Block[][]>([]);
  const [future, setFuture] = useState<Block[][]>([]);
  const [present, setPresent] = useState<Block[]>();

  const resetHistory = () => {
    setPast([]);
    setFuture([]);
    setPresent(props.placedBlocks);
  };

  const handleUndo = () => {
    if (past.length < 1) {
      return;
    }

    const undoTo = past[past.length - 1];

    if (undoTo === undefined) {
      return;
    }

    const newPast = past.slice(0, past.length - 1);

    setFuture([present, ...future]);
    props.setPlacedBlocks(undoTo);
    setPresent(undoTo);
    setPast(newPast);
    setSaved(false);
  };

  const handleRedo = () => {
    if (future.length < 1) {
      return;
    }

    const redoTo = future[0];

    if (redoTo === undefined) {
      return;
    }

    const newFuture = future.slice(1);

    setPast([...past, present]);
    props.setPlacedBlocks(redoTo);
    setPresent(redoTo);
    setFuture(newFuture);
    setSaved(false);
  };

  const updateHistory = (newPlacedBlocks: Block[]) => {
    setPast((prevPast) => [...prevPast, present]);
    setPresent(newPlacedBlocks);
    setFuture([]);
  };

  useEffect(() => {
    function compareBlockLists(a: Block[], b: Block[]) {
      if (isPanning === true) {
        return true;
      }
      if (JSON.stringify(a) === JSON.stringify(b)) {
        return true;
      }
      return false;
    }

    // If the placed blocks change, we update the history
    if (!compareBlockLists(props.placedBlocks, present)) {
      updateHistory(props.placedBlocks);
    }

    window.addEventListener("undo", handleUndo);
    window.addEventListener("redo", handleRedo);
    return () => {
      window.removeEventListener("undo", handleUndo);
      window.removeEventListener("redo", handleRedo);
    };
  }, [props.placedBlocks, past, future, present]);

  const initialMousePosition = useRef({ x: 0, y: 0 });

  const style = {
    cursor: isPanning ? "grabbing" : "default",
  };

  return (
    <div className="current-flow">
      {topBarTitle()}
      <div
        className="current-flow-canvas"
        ref={setNodeRef}
        id="current-flow-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMousePan}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={style}
      >
        <Xwrapper>{placedBlocksView}</Xwrapper>
        {/* Append the ServerFilePicker */}
        <ServerFileExplorerModal
          key={"serverFilePicker-flow-reciver"}
          fileProps={{
            openFolder: false,
            allowedExtensions: ["flow"],
            onFileSelect: () => {},
            onFileConfirm: (path: string) => {
              setServerFilePickerOpen(false);
              // Load the flow
              loadFlow({
                savedID: null,
                path: path,
              });
            },
          }}
          open={serverFilePickerOpen}
          setOpen={setServerFilePickerOpen}
        />
        {/* This one is for saving */}
        <ServerFileExplorerModal
          // key={"serverFolderPicker-flow-reciver"}
          fileProps={{
            openFolder: true,
            onFileSelect: () => {},
            onFileConfirm: (path: string) => {
              const strippedFlowName = flowName.replace(/[^a-zA-Z0-9]/g, "_");

              // append the flow name
              flowPath.current = path + "/" + strippedFlowName + ".flow";

              savedID.current = "new_flow";

              // Save the flow
              // preHandleSave();
              handleSave();
            },
          }}
          open={serverFolderPickerOpen}
          setOpen={setServerFolderPickerOpen}
        />
      </div>
    </div>
  );

  function handleMouseDown(e) {
    // Check that the user is clicking over the canvas and not anything else
    if (e.target.id === "current-flow-canvas") {
      setIsPanning(true);
      document.onselectstart = function () {
        return false;
      };
      initialMousePosition.current = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  }

  function handleMousePan(e) {
    // Move all blocks by delta
    if (isPanning) {
      // Get mouse delta
      const deltaX = e.clientX - initialMousePosition.current.x;
      const deltaY = e.clientY - initialMousePosition.current.y;

      initialMousePosition.current = {
        x: e.clientX,
        y: e.clientY,
      };
      moveBlocksPan(deltaX, deltaY);
    }
  }

  function centerView() {
    // Set the first block to be at the center of the canvas
    // Then move all blocks by delta respective to the first block
    const firstBlockPos = props.placedBlocks[0]?.position;

    if (!firstBlockPos) {
      return;
    }

    // Get the center of the canvas
    const canvas = document.getElementById("current-flow-canvas");
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    const canvasCenter = {
      x: canvasWidth / 3,
      y: canvasHeight / 3,
    };

    const delta = {
      x: -firstBlockPos.x + canvasCenter.x,
      y: -firstBlockPos.y + canvasCenter.y,
    };

    moveBlocksPan(delta.x, delta.y);
  }

  function moveBlocksPan(deltaX: number, deltaY: number) {
    props.setPlacedBlocks((blocks: Array<Block>) =>
      blocks.map((block: Block) => {
        return {
          ...block,
          position: {
            x: block.position.x + deltaX,
            y: block.position.y + deltaY,
          },
        };
      })
    );
  }

  function handleMouseUp(e) {
    setIsPanning(false);
    document.onselectstart = function () {
      return true;
    };
  }
}

interface ContextMenuRemotesProps {
  remotes: string[];
  setSelectedRemote: (remote: string) => void;
  show: boolean;
  setShow: (show: boolean) => void;
}

function ContextMenuRemotes(props: ContextMenuRemotesProps) {
  return (
    <div className={props.show ? "remotes active" : "remotes"}>
      {props.remotes.length > 0 ? (
        <div
          style={{
            fontSize: "initial",
            width: "8rem",
          }}
        >
          {props.remotes.map((option) => (
            <div
              style={{
                width: "100%",
              }}
              onClick={() => {
                props.setSelectedRemote(option);
                props.setShow(false);
              }}
            >
              {option}
              {
                // Add hr if its not the last element
                props.remotes.indexOf(option) !== props.remotes.length - 1 &&
                  props.remotes.length > 1 && <hr style={{ margin: 0 }} />
              }
            </div>
          ))}
        </div>
      ) : (
        <div>Local</div>
      )}
    </div>
  );
}

export { FlowReciver };
