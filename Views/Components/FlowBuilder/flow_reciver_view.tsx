import { BlockView, DraggableBlockView } from "./block_view";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { horusGet, horusPost, horusGetSettings } from "../../Utils/utils";
import RotatingLines from "../RotatingLines/rotatinglines";
import { useDroppable } from "@dnd-kit/core";
import { Xwrapper } from "react-xarrows";
import {
  VariableConnectionArrow,
  BlockConnectionArrow,
} from "./arrow_connector";
import { HorusModal, debounce } from "../reusable";
import {
  Block,
  BlockVarPair,
  FlowStatus,
  PluginVariableTypes,
} from "./flow_builder_types";
import FlowExecuter from "./flow_executer";
import { FlowBuilderController } from "./flow_builder_hooks";
import { ServerFileExplorerModal } from "../FileExplorer/file_explorer";
import { socket } from "../../Utils/socket";

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
  handleDelete: (block: Block) => void;
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
  updateCyclesCount: (destination: BlockVarPair, value: number) => void;
};

function FlowReciver(props: FlowReciverProps) {
  // Modal state
  const [flowName, setFlowName] = useState("New flow");
  const [isRunning, setIsRunning] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Saved flow vars
  const savedID = useRef(props.savedID ? props.savedID : "new_flow");
  const flowPath = useRef(props.flowPath || "");
  const { currentSaved, setSaved } = props;
  const [isSavingFlow, setIsSavingFlow] = useState(false);
  const [isLoadingFlow, setIsLoadingFlow] = useState(false);

  // Executing state
  const [executingAll, setExecutingAll] = useState(false);
  const [currentExecuting, setCurrentExecuting] = useState<number | null>(null);

  // Selected cluster
  const [remotesOptions, setRemotesOptions] = useState<string[]>([]);
  const [selectedRemote, setSelectedRemote] = useState<string | null>(null);

  const { setNodeRef } = useDroppable({
    id: "flow-reciver",
    disabled: isRunning,
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

  const updateMolstarState = async () => {
    setIsSavingFlow(true);

    try {
      const molstarState = await window.molstar?.snapshot.get();
      const formData = new FormData();
      formData.append("flowPath", flowPath.current);
      formData.append("molstarState", molstarState, "molstarState.molx");
      const headers = {
        Accept: "application/json",
      };
      const response = await horusPost(
        "/api/updatemolstate",
        headers,
        formData,
        null,
        10
      );
      const data = await response.json();

      if (!data.ok) {
        alert(data.error);
      }
    } catch (e) {
      alert("Error updating mol* state: " + e);
    }

    setIsSavingFlow(false);
  };

  const serializeFlow = () => {
    return {
      name: flowName,
      blocks: props.placedBlocks,
      savedID: savedID.current,
      path: flowPath.current,
      remote: selectedRemote,
      currentExecuting: flowExecuter.current.currentExecuting,
      terminalOutput: window.horusTerm.storedMessages,
    };
  };

  const handleSave = async () => {
    if (currentSaving.current) {
      return;
    }

    setIsSavingFlow(true);
    currentSaving.current = true;

    const body = new FormData();

    const saveContents = serializeFlow();

    body.append("flowData", JSON.stringify(saveContents));

    const molstarState = await window.molstar?.snapshot.get();
    body.append("molstarState", molstarState, "molstarState.zip");

    // Set the headers so that flask correctly accepts the form data
    const headers = {
      Accept: "application/json",
    };

    // Set a timeout on the first save only if the flow is NOT new
    // Otherwise the saving process will be canceled on the first save
    // while the user is selecting the folder where to save the flow
    // This happens only in the desktop version
    const timeout =
      window.isDesktop && savedID.current !== "new_flow" ? 10 : null;

    try {
      const response = await horusPost(
        "/api/saveflow",
        headers,
        body,
        null,
        timeout
      );
      var savedFlow = await response.json();
    } catch (e) {
      setIsSavingFlow(false);
      alert("Error saving flow. Try again");
      currentSaving.current = false;
      return;
    }

    if (!savedFlow.ok) {
      alert(savedFlow.error);
      currentSaving.current = false;
      setIsSavingFlow(false);
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
      setIsSavingFlow(false);
      currentSaving.current = false;
      return "cancelled";
    }

    if (overwrite) {
      const overwriteContents = {
        ...saveContents,
        name: existingName,
        path: path,
        overwrite: true,
      };
      const overwriteBody = new FormData();
      overwriteBody.append("flowData", JSON.stringify(overwriteContents));
      overwriteBody.append("molstarState", molstarState, "molstarState.zip");

      const overwriteResponse = await horusPost(
        "/api/saveflow",
        headers,
        overwriteBody,
        null,
        10
      );
      savedFlow = await overwriteResponse.json();

      if (!savedFlow.ok) {
        setIsSavingFlow(false);
        currentSaving.current = false;
        alert(savedFlow.error);
        return;
      }
    }
    setSaved(true);

    // Leave the socket flow room
    if (
      savedID.current !== "new_flow" &&
      savedID.current !== savedFlow.savedID
    ) {
      socket.emit("leaveFlow", savedID.current);
    }

    // setFlowName(savedFlow.name);
    savedID.current = savedFlow.savedID;
    flowPath.current = savedFlow.path;

    // Join the room with the new savedID
    socket.emit("joinFlow", savedID.current);

    setIsSavingFlow(false);
    currentSaving.current = false;
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

  const legacyRunner = async (block: Block): Promise<void> => {
    setExecutingAll(true);

    // Check that the flow is saved
    if (!currentSaved.current) {
      // Save the flow
      await preHandleSave();
      return;
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

  const loadSocketFlow = async (data) => {
    const { blocks, savedID: recivedID, status } = data;

    if (recivedID !== savedID.current) {
      // Its not the currently opened flow
      return;
    }

    const isRunning =
      status === FlowStatus.RUNNING || status === FlowStatus.PAUSED;

    setIsRunning(isRunning);

    if (status === FlowStatus.STOPPED) {
      setIsCancelling(false);
    }

    // If the flow has stopped running (is not RUNNING or PAUSED)
    // save the flow to apply any molstar* actions that run live
    // and that are not saved in the flow
    if (
      status !== FlowStatus.RUNNING &&
      status !== FlowStatus.PAUSED &&
      status !== FlowStatus.IDLE
    ) {
      if (
        window.molstar &&
        data.pendingActions &&
        data.pendingActions.length > 0
      ) {
        await applyPendingActions(data.pendingActions);
      }
    }

    // // Update the terminal output
    // // Set the terminal output
    // window.horusTerm.storedMessages = data.terminalOutput;

    // // Print all stored messages if the terminal is mounted
    // window.horusTerm.ref?.current?.pushToStdout(
    //   window.horusTerm.storedMessages
    //     ? window.horusTerm.storedMessages.join("\n")
    //     : ""
    // );

    props.setPlacedBlocks((currentBlocks) => {
      // Place the newblocks with the current block's position to avoid moving
      // the blocks when they are being executed
      return currentBlocks.map((b) => {
        // Find the block in the current blocks
        const newBlock = blocks.find((nb) => nb.placedID === b.placedID);

        newBlock.position = b.position;

        return newBlock;
      });
    });
  };

  const flowRunner = async (
    block: Block,
    resetRemote: boolean = false,
    resetFlow: boolean = true
  ): Promise<void> => {
    if (resetFlow) {
      // Clear the terminal if present
      window.horusTerm.ref?.current?.clearStdout();
      window.horusTerm.storedMessages = [];
    }

    const response = await horusPost(
      "/api/plugins/executeflow",
      null,
      JSON.stringify({
        flowPath: flowPath.current,
        placedID: block.placedID,
        resetRemote: resetRemote,
        resetFlow: resetFlow,
      })
    );

    const result = await response.json();

    if (!result.ok) {
      alert(result.message);
    }
  };

  const legacyRunnerSetting = useRef(false);

  const fetchLegacyRunner = async () => {
    // Get from the settings if we are using legacy mode
    const legacyBlockRunner = await horusGetSettings("legacyBlockRunner");

    let settingValue = false;
    try {
      const settingValue = legacyBlockRunner.value;
    } catch (e) {
      alert("Error getting legacyBlockRunner setting: " + e);
    }

    legacyRunnerSetting.current = settingValue;
  };

  const executeBlock = async (
    block: Block,
    resetFlow: boolean = true
  ): Promise<void> => {
    // First save the flow
    const saved = await preHandleSave({ comesFromExecuteBlock: true });
    if (!saved) {
      return;
    }
    const settingValue = legacyRunnerSetting.current;

    if (settingValue) {
      legacyRunner(block);
    } else {
      flowRunner(block, false, resetFlow);
    }
  };

  const checkRemoteBlock = async (block: Block): Promise<void> => {
    const settingValue = legacyRunnerSetting.current;

    if (settingValue) {
      flowExecuter.current.checkRemoteBlock(block);
    } else {
      return;
    }
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
    // if (!executingAll) {
    //   return;
    // }

    if (!confirm("Are you sure you want to stop executing the flow?")) {
      return;
    }

    setIsCancelling(true);

    const body = JSON.stringify({
      flowPath: flowPath.current,
    });

    const response = await horusPost("/api/plugins/stopflow", null, body);

    const data = await response.json();

    if (!data.ok) {
      alert(data.msg);
    }
    // setExecutingAll(false);

    // props.setPlacedBlocks((currentBlocks) => {
    //   return currentBlocks.map((b) => {
    //     if (b.isRunning) {
    //       b.isRunning = false;
    //       b.runError = true;
    //       b.runErrorMessage = "Flow execution stopped";
    //       b.finishedExecution = true;
    //     }
    //     return b;
    //   });
    // });

    // flowExecuter.current.stopExecute = true;
  };

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFlowName(e.target.value);
    setSaved(false);
  };

  const onBlockChange = (blockPlacedID: number) => {
    // Update the finishedExecution status
    // Update the placedBlocks array
    props.setPlacedBlocks((currentBlocks) => {
      return currentBlocks.map((b) => {
        if (b.placedID === blockPlacedID) {
          b.finishedExecution = false;
          b.runError = false;
        }
        return b;
      });
    });
    setSaved(false);
  };

  const openingFlow = useRef(false);
  const [serverFilePickerOpen, setServerFilePickerOpen] = useState(false);
  const [serverFolderPickerOpen, setServerFolderPickerOpen] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const [hasPendingActions, setHasPendingActions] = useState(false);

  useEffect(() => {
    window.horusTerm.storedMessages = terminalOutput;

    // Print all stored messages if the terminal is mounted
    window.horusTerm.ref?.current?.pushToStdout(
      window.horusTerm.storedMessages
        ? window.horusTerm.storedMessages.join("\n")
        : ""
    );
  }, [terminalOutput]);

  const internalLoadFlow = async (openedFlow: any) => {
    // Exit the socket flow room
    if (savedID.current !== "new_flow") {
      socket.emit("leaveFlow", savedID.current);
    }

    // Set the flow name
    setFlowName(openedFlow.name);
    savedID.current = openedFlow.savedID;
    flowPath.current = openedFlow.path;
    flowExecuter.current.setSavedID(savedID.current);
    flowExecuter.current.updatePlacedBlocks(openedFlow.blocks);
    flowExecuter.current.updateFlowPath(flowPath.current);

    setIsCancelling(false);

    // Set the terminal output
    setTerminalOutput(openedFlow.terminalOutput);

    setIsRunning(
      openedFlow.status === FlowStatus.RUNNING ||
        openedFlow.status === FlowStatus.PAUSED
    );

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

    // setTestSavedInternal(!isDefaultFlow);

    // console.log("Setting currentsaved to true");
    // currentSaved.current = true;

    savedID.current = openedFlow.savedID;

    openingFlow.current = false;

    // Connect to a socketio room with the flowID
    socket.emit("joinFlow", savedID.current);

    // Clean the terminal if present
    window.horusTerm.ref?.current?.clearStdout();

    // Apply any pending MolstarAPI actions if present
    if (openedFlow?.pendingActions && openedFlow.pendingActions.length > 0) {
      await applyPendingActions(openedFlow.pendingActions);
    }
  };

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

    setIsLoadingFlow(true);

    let data = {
      ok: false,
      flow: null,
      error: "Early error opening flow",
      molstarState: null,
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
      const response = await horusPost("/api/openrecentflow", header, body);
      data = await response.json();
    } else {
      const response = await horusGet("/api/openflow");
      data = await response.json();
    }

    if (!data.ok) {
      alert(data.error);
      openingFlow.current = false;
      setIsLoadingFlow(false);
      return;
    }

    const openedFlow = data.flow;

    if (!openedFlow) {
      openingFlow.current = false;
      return;
    }

    // Set the molstar state at the beggining in case blocks need structures
    // If it has the new molstar state, open it
    if (window.molstar) {
      if (data.molstarState) {
        await window.molstar.snapshot.set(data.molstarState);
      } else if (openedFlow.molstarState) {
        // If it has the old molstar state, open it
        await window.molstar.snapshot.set(openedFlow.molstarState);
      }
    }

    await internalLoadFlow(openedFlow);

    // Set the saved state
    setSaved(!isDefaultFlow);

    setIsLoadingFlow(false);
  };

  const applyPendingActions = async (pendingActions) => {
    setHasPendingActions(true);
    setIsRunning(true);
    for (const action of pendingActions) {
      await window.molstar?.applyAction(action);
    }

    // Save the mol* state after applying the actions
    await updateMolstarState();

    setIsRunning(false);
    setHasPendingActions(false);
  };

  const handlingNew = useRef(false);

  const handleNewInternal = async (bypass: boolean = false) => {
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

    // Leave the socket flow room
    if (savedID.current !== "new_flow") {
      socket.emit("leaveFlow", savedID.current);
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

    setIsRunning(false);
  };

  const handleNew = (bypass: boolean = false) => {
    // Add debouncing to execute the function only once
    debounce(handleNewInternal, 500)(bypass);
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
        props.handleDelete(block);
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
    const response = await horusGet("/api/remotes/names");
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

  const [flowSettings, setFlowSettings] = useState(null);

  const fetchFlowSettings = async () => {
    const showPlacedID = await horusGetSettings("showPlacedID");
    const allowRemotesOnNonSlurm = await horusGetSettings(
      "allowRemotesOnNonSlurm"
    );

    const loadedFlowSettings = {
      showPlacedID: showPlacedID?.value,
      allowRemotesOnNonSlurm: allowRemotesOnNonSlurm?.value,
    };

    setFlowSettings(loadedFlowSettings);
  };

  const [socketConnected, setSocketConnected] = useState(true);

  useEffect(() => {
    // Fetch remotes
    fetchRemotes();

    // Fetch legacy mode
    fetchLegacyRunner();

    // Fetch flow settings
    fetchFlowSettings();

    // When the socket.io connects, we need to join the flow room
    // In case the server was lost, socket.io will try to reconnect
    // therefore we need to join the room again so that the flow is always
    // updated
    socket.on("connect", () => {
      setSocketConnected(true);
      if (savedID.current !== "new_flow") {
        socket.emit("joinFlow", savedID.current);
      }
    });

    // When the socket.io disconnects, we need to leave the flow room
    // socket.on("disconnect", () => {
    //   if (savedID.current !== "new_flow") {
    //     socket.emit("leaveFlow", savedID.current);
    //   }
    // });

    // Display a message when socket.io disconnects
    socket.on("disconnect", () => {
      setSocketConnected(false);
    });

    // If we do not have connection at the beggining, set the state to false
    if (!socket.connected) {
      setSocketConnected(false);
    }

    // When a flow is updated from the backend, we need to update the flow on the canvas
    socket.on("flow", loadSocketFlow);

    return () => {
      socket.off("flow", loadSocketFlow);
      socket.off("connect");
      socket.off("disconnect");
      socket.off("leaveFlow");
      socket.off("joinFlow");
    };
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
  const preHandleSave = async ({
    comesFromExecuteBlock = false,
  }: {
    comesFromExecuteBlock?: boolean;
  } = {}) => {
    if (
      !window.isDesktop &&
      (flowPath.current === "" || flowPath.current === null)
    ) {
      if (comesFromExecuteBlock === true) {
        // Alert the user that the flow needs to be saved first
        alert(
          "The flow needs to be saved first. Please select a folder to save the flow"
        );
      }

      // Open the file picker
      setServerFolderPickerOpen(true);
      return false;
    }

    await handleSave();

    return true;
  };

  const debounceHandleSave = debounce(preHandleSave, 1000);

  useEffect(() => {
    // Update the window.horus.getFlow function
    window.horus.getFlow = () => {
      return serializeFlow();
    };

    // Update the window.horus.setFlow function
    window.horus.setFlow = (flow) => {
      internalLoadFlow(flow);
    };

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

  function TopBarTitle() {
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
        <div
          className="flex flex-col gap-0 items-center text-center"
          style={{
            minWidth: "8rem",
          }}
        >
          <button
            className="flow-button"
            style={{
              cursor: isRunning ? "pointer" : "default",
            }}
          >
            {isRunning ? (
              <div
                onClick={
                  isCancelling
                    ? () => {
                        // Do nothing
                      }
                    : stopExecutingAll
                }
              >
                <RotatingLines />
              </div>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                fill="none"
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
          {isCancelling && <div className="text-xs">Stopping</div>}
          {!socketConnected && (
            <div className="text-xs text-red-500">Disconnected</div>
          )}
          {hasPendingActions && (
            <div className="text-xs text-green-500">Applying actions</div>
          )}
        </div>
      </div>
    );
  }

  const renderBlock = (block: Block, index: number) => {
    const connectedVars = block.variableConnections?.map((connection) => {
      return (
        <VariableConnectionArrow
          key={`${block.placedID}-${connection.origin.placedID}-${connection.destination.placedID}`}
          connection={connection}
          unconnectVariables={props.unconnectVariables}
          isCyclic={connection.isCyclic}
          cycleNumber={connection.cycles}
          updateCyclesCount={props.updateCyclesCount}
          currentCycle={connection.currentCycle}
        />
      );
    });

    // const connectedBlocks = block.connectedTo?.map((connection) => {
    //   return (
    //     <BlockConnectionArrow
    //       key={`${block.placedID}-${connection}`}
    //       currentBlock={block}
    //       connectedBlock={props.placedBlocks.find(
    //         (b) => b.placedID === connection
    //       )}
    //       unconnectBlocks={props.unconnectBlocks}
    //     />
    //   );
    // });

    const selectRemote = (selectedRemote: string) => {
      props.setPlacedBlocks((prevBlocks) => {
        const newBlocks = [...prevBlocks];
        const blockIndex = newBlocks.findIndex(
          (blockToFind) => blockToFind.placedID === block.placedID
        );
        newBlocks[blockIndex].selectedRemote = selectedRemote;
        return newBlocks;
      });
    };

    const blockToRender: Block = {
      ...block,
      onChange: onBlockChange,
      execute: executeBlock,
      // // index={index}
      deleteBlock: props.handleDelete,
      isRunning: block.isRunning,
      checkRemoteStatus: checkRemoteBlock,
      setRemoteConnection: selectRemote,
    };

    const blockDisabledWhenRunning: CSSProperties = {
      pointerEvents: isRunning ? "none" : "auto",
      opacity: isRunning ? 0.75 : 1,
    };

    return (
      <div key={block.placedID} style={blockDisabledWhenRunning}>
        <DraggableBlockView
          settings={flowSettings}
          key={`${block.placedID}-${block.id}`}
          block={blockToRender}
          updateBlockSelectedGroup={updateBlockSelectedGroup}
          isConnecting={props.isConnecting}
          tryingToConnect={props.tryingToConnect}
        />
        {connectedVars}
        {/* {connectedBlocks} */}
      </div>
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

  const style: CSSProperties = {
    cursor: isPanning ? "grabbing" : isRunning ? "wait" : "auto",
  };

  return (
    <div className="current-flow">
      <HorusModal
        header="Saving flow"
        footer="Please wait while the flow is being saved."
        body={<RotatingLines />}
        size="sm"
        show={isSavingFlow}
      />
      <HorusModal
        header="Loading flow"
        footer="Please wait while the flow is being loaded."
        body={<RotatingLines />}
        size="sm"
        show={isLoadingFlow}
      />
      {TopBarTitle()}
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
            onFileConfirm: async (path: string) => {
              const strippedFlowName = flowName.replace(/[^a-zA-Z0-9]/g, "_");

              const currentFlowPath = flowPath.current;
              const currentSavedID = savedID.current;

              // append the flow name
              flowPath.current = path + "/" + strippedFlowName + ".flow";

              savedID.current = "new_flow";

              // Save the flow
              // preHandleSave();
              const confirmed = await handleSave();

              if (confirmed === "cancelled") {
                flowPath.current = currentFlowPath;
                savedID.current = currentSavedID;
              }
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
