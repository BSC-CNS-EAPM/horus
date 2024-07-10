// React
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import type { MouseEvent, PointerEvent } from "react";

// Drag and drop toolkit
import {
  DragEndEvent,
  DragStartEvent,
  useSensor,
  useSensors,
  getClientRect,
  MeasuringConfiguration,
  PointerSensor,
  SensorDescriptor,
  SensorOptions,
} from "@dnd-kit/core";

// Horus web-server
import { horusGet, horusPost } from "../../Utils/utils";
import { socket } from "../../Utils/socket";

// Types
import {
  Block,
  BlockVarPair,
  DraggableEntity,
  DroppableEntity,
  Flow,
  FlowStatus,
  VariableConnection,
} from "./flow.types";
import { FileExplorerProps } from "../FileExplorer/file_explorer";
import { usePrompt } from "../HorusPrompt/horus_prompt";
import { useAlert } from "../HorusPrompt/horus_alert";
import { useConfirm } from "../HorusPrompt/horus_confirm";

/**
 * An extended "PointerSensor" that prevent some
 * interactive html element(button, input, textarea, select, option...) from dragging
 */
class SmartPointerSensor extends PointerSensor {
  static override activators = [
    {
      eventName: "onPointerDown" as any,
      handler: ({ nativeEvent: event }: PointerEvent) => {
        if (
          !event.isPrimary ||
          event.button !== 0 ||
          isInteractiveElement(event.target as Element)
        ) {
          return false;
        }

        return true;
      },
    },
  ];
}

/**
 * Helper function to check if an element is interactive
 * This is to prevent dragging of blocks when clicking on buttons, inputs, etc
 * @param element The element to check
 * @returns Whether the element is interactive or not
 */
function isInteractiveElement(element: Element | null) {
  const interactiveElements = [
    "button",
    "input",
    "textarea",
    "select",
    "option",
    "rect",
    "pre",
    "a",
    "img",
  ];

  // Disable drag on the blurred mdoal
  if (
    element?.id?.includes("modal") ||
    element?.id?.includes("block-error-title")
  ) {
    return true;
  }

  if (
    element?.tagName &&
    interactiveElements.includes(element.tagName.toLowerCase())
  ) {
    return true;
  }

  return false;
}

/**
 * Moves a block by updating its position.
 * @param block - The block to move.
 * @param delta - The amount to move the block by in the x and y directions.
 * @returns The updated block with the new position.
 */
function moveBlock(
  block: Block,
  delta = { x: 0, y: 0 },
  scale: number = 1
): Block {
  // Set the new position
  const newBlock: Block = {
    ...block,
    position: {
      x: block.position.x + delta.x * (1 / scale),
      y: block.position.y + delta.y * (1 / scale),
    },
  };

  return newBlock;
}

/**
 * Custom hook for DND tweaks.
 *
 * @returns An object containing the sensors and measuring configuration for DND.
 */
function useDNDTweaks(): {
  sensors: SensorDescriptor<SensorOptions>[];
  measuring: MeasuringConfiguration;
} {
  // DND tweaks
  const mouseSensor = useSensor(SmartPointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });

  const sensors = useSensors(mouseSensor);

  const measuring: MeasuringConfiguration = {
    droppable: {
      measure: getClientRect,
    },
  };

  return { sensors, measuring };
}

// Helper function
function convertRemToPixels(rem: number): number {
  return rem * parseFloat(getComputedStyle(document.documentElement).fontSize);
}

function newFlowObject(): Flow {
  return {
    savedID: null,
    path: null,
    name: "New flow",
    status: FlowStatus.IDLE,
    date: Date.now().toString(),
    blocks: [],
    terminalOutput: [],
    pendingActions: [],
    pendingSmilesActions: [],
    elapsed: 0,
  };
}

// Create a new flow builder hook
export function useFlowBuilder() {
  // Initialize the drag and drop tweaks
  const dndTweaks = useDNDTweaks();

  // Store the state of the flow
  const [flow, setFlow] = useState<Flow>(newFlowObject());
  const [saved, setSaved] = useState<boolean>(true);

  // The arow connections
  const blockConnections = useMemo<VariableConnection[]>(() => {
    const connections: VariableConnection[] = [];

    flow.blocks.forEach((block) => {
      block.variableConnections.forEach((connection) => {
        connections.push(connection);
      });
    });

    return connections;
  }, [flow]);

  const horusAlert = useAlert();
  const horusConfirm = useConfirm();

  // Store the state of the placed blocks
  const placedIDCounter = useRef<number>(1);

  // The dragging block is the UI element that will be displayed when the user is dragging the block from the block list into the canvas
  const [draggingBlock, setDraggingBlock] = useState<Block | null>();

  // The connecting variable is the variable that is being dragged from a block to another
  const [connectingVariable, setConnectingVariable] =
    useState<BlockVarPair | null>(null);

  // State for loading the flow
  const [flowLoading, setFlowLoading] = useState<boolean>(false);
  const [flowText, setFlowText] = useState<string>("Flow busy");
  const isFlowActive = useMemo(() => {
    return (
      flow.status === FlowStatus.RUNNING ||
      flow.status === FlowStatus.CANCELLING ||
      flow.status === FlowStatus.QUEUED
    );
  }, [flow]);

  // State for the remote servers
  const [remotesOptions, setRemotesOptions] = useState<string[]>([]);

  // In order to correctly determine where to place the block, we need to know the mouse position
  const mousePos = useRef({ x: 0, y: 0 });

  // We need to know if the user is panning the canvas
  const [isPanning, setIsPanning] = useState(false);
  const initialPanPosition = useRef({ x: 0, y: 0 });

  // Undo and redo history
  const [past, setPast] = useState<Flow[]>([]);
  const [future, setFuture] = useState<Flow[]>([]);

  const resetHistory = useCallback(() => {
    setPast([]);
    setFuture([]);
  }, []);

  function handleHistoryChange(newFlow: Flow) {
    setPast((prevPast) => [...prevPast, newFlow]);
    setFuture([]);
  }

  // Helper function that should be called every time the flow changes
  // It updates the flow state and the saved state
  const handleFlowChange = useCallback(
    (newFlow: Flow, updateHistory: boolean = false) => {
      const handledFlow: Flow = { ...newFlow, status: FlowStatus.IDLE };
      setFlow((currentFlow) => {
        if (updateHistory) {
          handleHistoryChange(currentFlow);
        }
        return handledFlow;
      });
      setSaved(false);
    },
    []
  );

  const updateMolstarState = useCallback(async () => {
    // Check that the flow has a valid path and
    // that Mol* is mounted
    if (!flow.path) {
      return;
    }

    try {
      // Save the mol* and smiles state
      const formData = new FormData();
      formData.append("flowPath", flow.path);

      if (window.molstar) {
        const molstarState = await window.molstar.snapshot.get();
        formData.append("molstarState", molstarState, "molstarState.molx");
      }

      if (window.smiles) {
        const smilesState = await window.smiles.saveState();
        formData.append("smilesState", JSON.stringify(smilesState));
      }

      const headers = {
        Accept: "application/json",
      };

      const response = await horusPost(
        "/api/updatemolstate",
        headers,
        formData,
        undefined,
        10
      );
      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.msg);
      }

      // Empty the pending actions
      setFlow((currentFlow) => {
        return {
          ...currentFlow,
          pendingActions: [],
          pendingSmilesActions: [],
        };
      });
    } catch (e) {
      await horusAlert("Error updating mol* state: " + e);
    }
  }, [flow.path]);

  const internalLoadFlow = useCallback(
    async (openedFlow: Flow) => {
      // Exit the socket flow room
      socket.emit("leaveFlow", flow.savedID);

      // Connect to a socketio room with the flowID
      socket.emit("joinFlow", openedFlow.savedID);

      // Set the flow state
      setFlow(openedFlow);

      // Set the placedIDCounter
      // Search for the highest placedID in the blocks and subblocks
      const placedIDs = openedFlow.blocks.map((b) => b.placedID);

      placedIDCounter.current = Math.max(...placedIDs) + 1;

      if (openedFlow.terminalOutput.length > 0) {
        window.horusTerm.storedMessages = openedFlow.terminalOutput;

        // Print all stored messages if the terminal is mounted
        window.horusTerm.ref?.current?.pushToStdout(
          window.horusTerm.storedMessages
            ? window.horusTerm.storedMessages.join("\n")
            : ""
        );
      }

      // Apply any pending MolstarAPI actions if present
      let hasToUpdate = false;
      if (window.molstar) {
        if (openedFlow.pendingActions && openedFlow.pendingActions.length > 0) {
          hasToUpdate = true;
          for (const action of openedFlow.pendingActions) {
            await window.molstar?.applyAction(action);
          }
        }
      }

      if (window.smiles) {
        if (
          openedFlow.pendingSmilesActions &&
          openedFlow.pendingSmilesActions.length > 0
        ) {
          hasToUpdate = true;
          for (const action of openedFlow.pendingSmilesActions) {
            await window.smiles?.applyAction(action);
          }
        }
      }

      if (hasToUpdate) {
        // Save the mol* state after applying the actions
        await updateMolstarState();
      }

      // Set the block connections
      const blockConnections: VariableConnection[] = [];
      for (const block of openedFlow.blocks) {
        for (const variableConnection of block.variableConnections) {
          blockConnections.push(variableConnection);
        }
      }
    },
    [flow.savedID, updateMolstarState]
  );

  const isLoadingFlow = useRef<boolean>(false);

  const loadFlow = useCallback(
    async (
      openRecent: {
        savedID: string | null;
        path: string;
        template?: boolean;
      } | null = null
    ) => {
      // If the flow is already loading, exit early
      if (isLoadingFlow.current) {
        return;
      }

      if (
        !saved &&
        !(await horusConfirm(
          "Current flow is not saved. Are you sure you want to open a new one?"
        ))
      ) {
        return;
      }

      isLoadingFlow.current = true;
      setFlowText("Opening flow");
      setFlowLoading(true);

      // Wait a second for the animation to play
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        // Define the initial data to open the flow
        let data: {
          ok: boolean;
          flow: Flow | null;
          msg: string;
          molstarState: string | null;
          smilesState: string | null;
        } = {
          ok: false,
          flow: null,
          msg: "Early error opening flow",
          molstarState: null,
          smilesState: null,
        };

        // If a default flow is being opened, some variables need to be set
        let isDefaultFlow = false;

        // If the flow is being opened from the recent flows list, use the savedID
        if (openRecent !== null) {
          const header = {
            "Content-Type": "application/json",
            Accept: "application/json",
          };

          if (openRecent.path === undefined || openRecent.template) {
            isDefaultFlow = true;
          }

          const body = JSON.stringify({
            savedID: openRecent.savedID,
            path: openRecent.path,
            template: openRecent.template,
          });
          const response = await horusPost("/api/openrecentflow", header, body);
          data = await response.json();
        } else {
          const response = await horusGet("/api/openflow");
          data = await response.json();
        }

        if (!data.ok) {
          await horusAlert(data.msg);
          return;
        }

        const openedFlow = data.flow;

        if (!openedFlow) {
          return;
        }

        // Set the molstar state at the beggining in case blocks need structures
        // If it has the new molstar state, open it
        if (window.molstar && data.molstarState) {
          await window.molstar.snapshot.set(data.molstarState);
        }

        // If smiles state, open it
        if (window.smiles && data.smilesState) {
          await window.smiles.restoreState(JSON.parse(data.smilesState));
        }

        await internalLoadFlow(openedFlow);

        // Set the saved state
        setSaved(!isDefaultFlow);

        // Reset the history
        resetHistory();
      } finally {
        setFlowLoading(false);
        isLoadingFlow.current = false;
      }
    },
    [saved, resetHistory, setSaved, internalLoadFlow]
  );

  // State for the server file picker
  const [serverFilePickerOpen, setServerFilePickerOpen] =
    useState<boolean>(false);

  const serverPickerFlow = useCallback(() => {
    return {
      openFolder: false,
      allowedExtensions: [".flow"],
      onFileSelect: () => {},
      onFileConfirm: (path: string) => {
        setServerFilePickerOpen(false);
        // Load the flow
        loadFlow({
          savedID: null,
          path: path,
        });
      },
    };
  }, [loadFlow]);

  const [fileProps, setFileProps] = useState<FileExplorerProps>(
    serverPickerFlow()
  );

  const [scale, setScale] = useState<number>(1);

  async function handleScaleChange(newScale: number | number[]) {
    // Get the number
    const newScaleNumber =
      (Array.isArray(newScale) ? newScale[0] : newScale) || 1;

    // Max value is 1.5 and min value is 0.1
    if (newScaleNumber > 1.5 || newScaleNumber < 0.1) {
      return;
    }

    setScale(newScaleNumber);
  }

  // function handleMouseWheel(event: WheelEvent) {
  //   event.preventDefault();

  //   // If the modifier key is pressed, scale the view
  //   if (event.getModifierState(modifierKey)) {
  //     if (event.deltaY > 0) {
  //       handleScaleChange(scale - 0.1);
  //     } else {
  //       handleScaleChange(scale + 0.1);
  //     }
  //     // Otherwise, pan the view
  //   } else {
  //     const deltaX = -event.deltaX;
  //     const deltaY = -event.deltaY;
  //     moveBlocksPan(deltaX * (1 / scale), deltaY * (1 / scale));
  //   }
  // }

  const serializeFlow = useCallback((): Flow => {
    return {
      ...flow,
      terminalOutput: window.horusTerm.storedMessages,
    };
  }, [flow]);

  const isSaving = useRef<boolean>(false);

  /**
   * Saves the flow data to the server.
   *
   * @param flowToSave - Optional flow object to save. If not provided, the current flow will be serialized and saved.
   * @returns A Promise that resolves to the saved Flow object if successful, or null otherwise.
   */
  const handleSave = useCallback(
    async (flowToSave?: Flow): Promise<Flow | null> => {
      // If the flow is already saving, exit early
      if (isSaving.current) {
        return null;
      }

      // Set the state
      isSaving.current = true;
      setFlowText("Saving flow");
      setFlowLoading(true);

      // The serialization of the flow to save
      const saveContents = flowToSave ? flowToSave : serializeFlow();

      // Set a timeout on the first save only if the flow is NOT new
      // Otherwise the saving process will be canceled on the first save
      // while the user is selecting the folder where to save the flow
      // This happens only in the desktop version, but we will setup
      // the timeout for both versions as the request might fail due
      // to Flask request aprser not being able to parse the form data
      // mainly due the Mol* state being too large. Sometimes sending
      // the request again fixes the issue
      const timeout = saveContents.path ? 10 : null;

      try {
        // Prepare the body for the save request
        const body = new FormData();
        body.append("flowData", JSON.stringify(saveContents));

        // Append the molstar and smiles state if present
        let molstarState: Blob | null = null;
        let smilesState: string | null = null;
        if (window.molstar) {
          molstarState = await window.molstar!.snapshot.get();
          body.append("molstarState", molstarState, "molstarState.zip");
        }

        if (window.smiles) {
          smilesState = JSON.stringify(window.smiles.saveState());
          body.append("smilesState", smilesState);
        }

        // Set the headers so that flask correctly accepts the form data
        const headers = {
          Accept: "application/json",
        };

        // Post the flow to the server
        const response = await horusPost(
          "/api/saveflow",
          headers,
          body,
          undefined,
          timeout
        );

        // Read the response
        let savedFlow = await response.json();

        if (!savedFlow) {
          await horusAlert("No response from the server");
          return null;
        }

        if (!savedFlow.ok) {
          savedFlow?.msg && (await horusAlert(savedFlow.msg));
          return null;
        }

        // Get relevant flow data
        // If we are on App mode, the overwrite process gets handled by the system file explroer,
        // on server mode though, we need to handle the overwrite process here, this is why we
        //  to parse the overwrite and existingName flags
        const overwrite = savedFlow.overwrite;
        const existingName = savedFlow.existingName;
        const path = overwrite ? savedFlow.path : saveContents.path;
        const desktop = savedFlow.desktop;

        // Check if the flow with the same name already exists
        if (
          overwrite &&
          !desktop &&
          !(await horusConfirm(
            "Flow with the same name already exists. Are you sure you want to overwrite the flow?"
          ))
        ) {
          return null;
        }

        // If the user decided to overwrite the flow, re-send the request with the overwrite flag
        if (overwrite) {
          // Re send the request with the overwrite flag
          const overwriteContents = {
            ...saveContents,
            name: existingName,
            path: path,
            overwrite: true,
          };

          // Create a new form data object
          const overwriteBody = new FormData();
          overwriteBody.append("flowData", JSON.stringify(overwriteContents));

          // Append the molstar state if present
          if (molstarState) {
            overwriteBody.append(
              "molstarState",
              molstarState,
              "molstarState.zip"
            );
          }

          // Append the smiles state if present
          if (smilesState) {
            overwriteBody.append("smilesState", smilesState);
          }

          // Send the request again
          const overwriteResponse = await horusPost(
            "/api/saveflow",
            headers,
            overwriteBody,
            undefined,
            10
          );

          savedFlow = await overwriteResponse.json();

          if (!savedFlow.ok) {
            await horusAlert(savedFlow.msg);
            return null;
          }
        }

        // If everything went well, update the flow state
        socket.emit("leaveFlow", saveContents.savedID);

        handleFlowChange({
          ...saveContents,
          savedID: savedFlow.savedID,
          path: savedFlow.path,
        });

        latestPath.current = savedFlow.path;

        // Join the room with the new savedID
        socket.emit("joinFlow", savedFlow.savedID);

        (!flowToSave?.template || saved) && setSaved(true);

        return savedFlow as Flow;
      } finally {
        // Reset the state of the loading flow when everything is done
        isSaving.current = false;
        setFlowLoading(false);
      }
    },
    [serializeFlow, handleFlowChange, saved]
  );

  const serverPickerFolder = useCallback(() => {
    return {
      openFolder: true,
      onFileSelect: () => {},
      onFileConfirm: async (path: string) => {
        const flowToSave = flow;
        const strippedFlowName = flowToSave.name.replace(/[^a-zA-Z0-9]/g, "_");

        // append the flow name
        flowToSave.path = path + "/" + strippedFlowName + ".flow";
        flowToSave.savedID = null;

        // Save the flow
        await handleSave(flowToSave);
      },
    };
  }, [flow, handleSave]);

  // Helper function that should be called every time any block changes
  // It updates the flow state and the saved state efficiently
  const handleBlockChanges = (
    newBlocks: Block[],
    isNew: boolean = false,
    updateHistory: boolean = false,
    resetExecution: boolean = true
  ) => {
    const updatedBlocks = isNew
      ? [...flow.blocks, ...newBlocks]
      : flow.blocks.map((block: Block) => {
          const matchingNewBlock = newBlocks.find(
            (newBlock: Block) => newBlock.placedID === block.placedID
          );

          if (matchingNewBlock) {
            return {
              ...matchingNewBlock,
              finishedExecution: resetExecution
                ? false
                : block.finishedExecution,
            } as Block;
          }

          return block;
        });

    const newFlow: Flow = {
      ...flow,
      blocks: updatedBlocks,
    };

    handleFlowChange(newFlow, updateHistory);
  };

  // Helper function that efficiently returns the blocks with the given placedID
  const findBlocks = (blockIDs: Array<number>): Array<Block> | null => {
    // Find and sort the blocks found blocks by the same order the blockIDs were given
    // So that the returning array is in the same order as the blockIDs
    // We need to prevent looping over the flow.blocks array multiple times
    // because it is an expensive operation
    const blockMap = new Map();

    // Map the blocks by their placedID
    flow.blocks.forEach((block) => blockMap.set(block.placedID, block));

    // Generate a new list based on the map
    const found = blockIDs
      .map((blockID) => blockMap.get(blockID))
      .filter(Boolean);

    return found.length > 0 ? found : null;
  };

  // Called every time a block is placed or moved
  const handleDragEnd = (event: DragEndEvent) => {
    // Because the drag ended, the dragging block is no longer needed
    setDraggingBlock(null);

    // Extract the variables from the event
    // Active: The block that was dragged
    // Over: The droppable element that the block was dropped on
    const { active, over } = event;

    // Parse the type of the dragged block, it could be a dragged connection arrow instead
    const draggedBlockType: DraggableEntity = active.data.current?.["type"];

    // Check for an variable-variable / block-block connection
    if (draggedBlockType === DraggableEntity.CONNECTOR) {
      // Verify that the variable was dropped on a block
      const overContainer: DroppableEntity = over?.data?.current?.["type"];

      // Obtain the block-var pair and the dropped on variable
      const blockVarPair = active.data.current?.[
        "blockVarPair"
      ] as BlockVarPair;
      const droppedOn = over?.data.current?.["blockVarPair"] as BlockVarPair;

      // Verify that the variable was dropped on a block
      if (
        overContainer !== DroppableEntity.VARIABLE_CONNECTION ||
        !blockVarPair ||
        !droppedOn
      ) {
        // Cancel the connection
        setConnectingVariable(null);
      } else {
        connectVars(blockVarPair, droppedOn);
      }
      return;
    }

    // Get the current dragged block
    const currentBlock = active.data.current?.["block"] as Block | undefined;

    // If there is no current block, exit early
    if (!currentBlock) {
      return;
    }

    // Get the over container
    const overContainer = over?.id;

    // If the over container is not the canvas, exit early

    // If its already placed, its a moving operations
    if (currentBlock.isPlaced) {
      handleBlockMove(currentBlock, event.delta);
      return;
    }

    // If its not placed, its a placing operation
    if (overContainer === DroppableEntity.CANVAS) {
      addBlockToFlow(currentBlock);
    }
  };

  const handleBlockMove = (
    block: Block,
    delta: {
      x: number;
      y: number;
    }
  ) => {
    // Update the state
    handleBlockChanges([moveBlock(block, delta, scale)], false, true, false);
  };

  const addBlockToFlow = (block: Block) => {
    // The block position should be the mouse position plus 1/2 the width and height of the block
    const position = {
      x: mousePos.current.x / scale - convertRemToPixels(10),
      y: mousePos.current.y / scale - convertRemToPixels(3),
    };

    const newBlock: Block = {
      ...block,
      isPlaced: true,
      placedID: placedIDCounter.current,
      position: position,
      variables: block.variables.map((variable) => {
        return {
          ...variable,
          placedID: placedIDCounter.current,
        };
      }),
    };

    handleBlockChanges([newBlock], true, true);

    // Update the placedIDCounter
    placedIDCounter.current += 1;
  };

  const handleDragStart = (event: DragStartEvent) => {
    // Get the current dragged block
    const { active } = event;

    const draggedBlockType: DraggableEntity = active.data.current?.["type"];

    if (draggedBlockType === DraggableEntity.CONNECTOR) {
      // Obtain the block-var pair
      const blockVarPair = active.data.current?.[
        "blockVarPair"
      ] as BlockVarPair;

      // If we do not have a blockVarPair, exit early
      blockVarPair && setConnectingVariable(blockVarPair);

      return;
    }

    // If we are moving a block, set the state for the drag overlay
    // If the block is already placed, don't do anything, the block
    // useDraggable() hook will handle the drag animation
    const currentBlock = active.data.current?.["block"] as Block | undefined;

    // If there is no current block, exit early
    if (!currentBlock) {
      return;
    }

    if (!currentBlock.isPlaced) {
      setDraggingBlock(currentBlock);
    }
  };

  // Update the mouse position
  const handleMouseMove = (event: MouseEvent) => {
    const scaledCanvas = document.getElementById(DroppableEntity.SCALED_CANVAS);

    if (!scaledCanvas) {
      return;
    }

    const scaledRect = scaledCanvas.getBoundingClientRect();

    mousePos.current = {
      x: event.clientX - scaledRect.x,
      y: event.clientY - scaledRect.y,
    };
  };

  const handleDelete = async (block: Block) => {
    // Check first if the block to delete is connected to a variable wich also
    // has a cyclic connection
    for (const variableConnection of block.variableConnections) {
      if (variableConnection.isCyclic) {
        await horusAlert("Remove the cyclic connection first");
        return;
      }
    }

    for (const variableReference of block.variableConnectionsReference) {
      const connectedBlock = flow.blocks.find(
        (b) => b.placedID === variableReference.destination.placedID
      );

      // If the connected block is not found, continue
      if (!connectedBlock) {
        continue;
      }

      const cyclic = checkCyclicFlow(block, connectedBlock);

      if (cyclic) {
        await horusAlert("Remove the cyclic connection first");
        return;
      }
    }

    let updatedBlocks = flow.blocks;
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
        const realBlock = updatedBlocks.find(
          (b) => b.placedID === varConnected.destination.placedID
        );

        if (!realBlock) {
          continue;
        }

        // Remove from the real block the variable connection
        realBlock.variableConnections = realBlock.variableConnections.filter(
          (v) => v.origin.placedID !== block.placedID
        );

        // Update the placedBlocks array
        updatedBlocks = updatedBlocks.map((b) => {
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
        const realBlock = updatedBlocks.find(
          (b) => b.placedID === varConnected.origin.placedID
        );

        if (!realBlock) {
          continue;
        }

        // Remove from the real block the variable connection reference
        realBlock.variableConnectionsReference =
          realBlock.variableConnectionsReference.filter(
            (v) => v.destination.placedID !== block.placedID
          );

        // Update the placedBlocks array
        updatedBlocks = updatedBlocks.map((b) => {
          if (b.placedID === realBlock.placedID) {
            b.variableConnectionsReference =
              realBlock.variableConnectionsReference;
          }
          return b;
        });
      }
    }

    // Delete the block
    updatedBlocks = updatedBlocks.filter((b) => b.placedID !== block.placedID);

    // Update the flow
    handleFlowChange(
      {
        ...flow,
        blocks: updatedBlocks,
      },
      true
    );
  };

  const updateCyclesCount = (destination: BlockVarPair, cycles: number) => {
    // Get the destination block
    const destinationBlock = flow.blocks.find((b) => {
      return b.placedID === destination.placedID;
    });

    // Check that the block exists
    if (!destinationBlock) {
      return;
    }

    // Get the connection that is cyclic
    const connection = destinationBlock.variableConnections.find((vc) => {
      return (
        vc.destination.variableID === destination.variableID && vc.isCyclic
      );
    });

    // Update the cycles
    const newConnection = {
      ...connection,
      cycles: cycles,
      currentCycle: 0,
    };

    const updatedBlocks = flow.blocks.map((b: Block) => {
      if (b.placedID === destinationBlock.placedID) {
        return {
          ...b,
          variableConnections: b.variableConnections.map((vc) => {
            if (
              vc.destination.variableID === destination.variableID &&
              vc.isCyclic
            ) {
              return newConnection;
            }
            return vc;
          }),
        } as Block;
      }
      return b;
    });

    // Update the state
    handleBlockChanges(updatedBlocks);
  };

  const unconnectVariables = async (connection: VariableConnection) => {
    // First find the real blocks from the placedBlocks array

    const [originBlock, destinationBlock] = findBlocks([
      connection.origin.placedID,
      connection.destination.placedID,
    ]) as [Block, Block];

    // If the blocks are not found, exit early
    if (!originBlock || !destinationBlock) {
      return;
    }

    // Check if at any point the connection is cyclic
    const cyclic = checkCyclicFlow(originBlock, destinationBlock);

    if (cyclic && !connection.isCyclic) {
      await horusAlert("Remove the cyclic connection first");
      return;
    }

    // Remove the connection from the "destination" block
    const newDestinationBlock: Block = {
      ...destinationBlock,
      variableConnections: destinationBlock.variableConnections.filter((b) => {
        // Delete the connection that comes from the same block
        const sameBlock = b.origin.placedID === originBlock.placedID;
        // Delete the connection that comes from the same variable
        const sameVar = b.origin.variableID === connection.origin.variableID;

        return !(sameBlock && sameVar);
      }),
    };

    // Remove the connection reference from the "origin" block
    const newOriginBlock: Block = {
      ...originBlock,
      variableConnectionsReference:
        originBlock.variableConnectionsReference.filter((b) => {
          // Delete the connection that goes to the same block
          const sameBlock =
            b.destination.placedID === destinationBlock.placedID;

          // Delete the connection that goes to the same variable
          const sameVar =
            b.destination.variableID === connection.destination.variableID;

          return !(sameBlock && sameVar);
        }),
    };

    // Update the state
    handleBlockChanges(
      [newDestinationBlock, newOriginBlock],
      false,
      true,
      false
    );
  };

  function checkCyclicFlow(origin: Block, destination: Block) {
    // Loop over the destination block connections
    // if the origin block is found, there is a cycle

    // If one of the connections is already cyclic, exit early to
    // prevent infinite loops
    let existingCyclic = destination.variableConnections.find((vc) => {
      return vc.isCyclic;
    });

    if (existingCyclic) {
      return existingCyclic.origin.placedID === origin.placedID;
    }

    existingCyclic = destination.variableConnectionsReference.find((vc) => {
      return vc.isCyclic;
    });

    if (existingCyclic) {
      return true;
    }

    // Check that the destination block has connections
    if (!destination.variableConnectionsReference) {
      return false;
    }

    const nextBlocks = destination.variableConnectionsReference.map((vc) => {
      return vc.destination.placedID;
    });

    if (nextBlocks.includes(origin.placedID)) {
      return true;
    }

    // Check the next blocks
    for (const nextBlock of nextBlocks) {
      const nextBlockObj = flow.blocks.find((b) => b.placedID === nextBlock);

      if (!nextBlockObj) {
        continue;
      }

      if (checkCyclicFlow(origin, nextBlockObj)) {
        return true;
      }
    }

    return false;
  }

  function connectVars(origin: BlockVarPair, destination: BlockVarPair) {
    // Prevent connecting to the same block
    if (origin.placedID === destination.placedID) {
      return;
    }

    // Get the origin block directly form the variable pair (using the block placedID)
    const originBlock = flow.blocks.find((b) => {
      return b.placedID === origin.placedID;
    });

    // Get the destination block
    const destinationBlock = flow.blocks.find((b) => {
      return b.placedID === destination.placedID;
    });

    // Verify that the blocks exist
    if (!originBlock || !destinationBlock) {
      return;
    }

    // Check that is not already connected by checking
    // the variableConnectionsReference of the destination block
    if (
      destinationBlock.variableConnections.find((vc) => {
        return vc.origin.placedID === destination.placedID;
      })
    ) {
      return;
    }

    // Check if the connection is cyclic with the helper function
    const cyclic = checkCyclicFlow(originBlock, destinationBlock);

    // If its not cyclic, and the destination variable is already connected
    // to another variable, we don't allow the connection. Only one connection
    // per variable is allowed
    if (
      !cyclic &&
      destinationBlock.variableConnections.find((vc) => {
        // Also the destination variable should not be cyclic
        return (
          vc.destination.variableID === destination.variableID && !vc.isCyclic
        );
      })
    ) {
      return;
    }

    // Set the variableConnections to the overBlock
    // Create a new block with the new connection
    const newDestinationBlock: Block = {
      ...destinationBlock,
      variableConnections: [
        ...destinationBlock.variableConnections,
        {
          origin: origin,
          destination: destination,
          isCyclic: cyclic,
          cycles: 1,
          currentCycle: 0,
        },
      ],
    };

    // Add a reference to the connection on the dragged block
    const newOriginBlock: Block = {
      ...originBlock,
      variableConnectionsReference: [
        ...originBlock.variableConnectionsReference,
        {
          origin: origin,
          destination: destination,
          isCyclic: cyclic,
          cycles: 1,
          currentCycle: 0,
        },
      ],
    };

    // Update the state
    handleBlockChanges(
      [newDestinationBlock, newOriginBlock],
      false,
      true,
      false
    );
  }

  const loadSocketFlow = useCallback(
    async (recivedFlow: Flow) => {
      // Fixes overwritting the queued or running states with the
      // new recived flow that comes from the preHandleSave function
      // inside the executeFlow function. This prevented the flow to update
      // even tough the flow was running
      if (isExecutingInProcess.current) {
        return;
      }

      setFlow((currentFlow) => {
        if (recivedFlow.savedID !== currentFlow.savedID) {
          // Its not the currently opened flow
          // Ignore the socket flow
          return currentFlow;
        }

        // Do not update the position of the blocks
        // This is because the user might be panning the view
        // during the flow execution
        const parsedFlow: Flow = {
          ...recivedFlow,
          blocks: recivedFlow.blocks.map((block) => {
            return {
              ...block,
              position: currentFlow.blocks.find(
                (b) => b.placedID === block.placedID
              )?.position ?? { x: 0, y: 0 },
            };
          }),
        };

        const applyActions = async () => {
          // Check for any pending actions if the flow has finished
          if (recivedFlow.status !== FlowStatus.RUNNING) {
            let hasToUpdate = false;
            if (
              recivedFlow.pendingActions &&
              recivedFlow.pendingActions.length > 0
            ) {
              hasToUpdate = true;
              for (const action of recivedFlow.pendingActions) {
                await window.molstar?.applyAction(action);
              }
            }

            if (
              recivedFlow.pendingSmilesActions &&
              recivedFlow.pendingSmilesActions.length > 0
            ) {
              hasToUpdate = true;
              for (const action of recivedFlow.pendingSmilesActions) {
                await window.smiles?.applyAction(action);
              }
            }

            if (hasToUpdate) {
              // Save the mol* state after applying the actions
              await updateMolstarState();
            }
          }
        };

        applyActions();

        return parsedFlow;
      });
    },
    [updateMolstarState]
  );

  async function fetchRemotes() {
    const response = await horusGet("/api/remotes/names");
    const data = await response.json();

    if (!data.ok) {
      await horusAlert(data.msg);
      return;
    }

    setRemotesOptions(data.remotes);
  }

  // Handle a new flow.
  const handleNewFlow = useCallback(async () => {
    if (
      !saved &&
      !(await horusConfirm(
        "Current flow is not saved. Are you sure you want to create a new flow?"
      ))
    ) {
      return;
    }

    setFlowText("Opening a new flow");
    setFlowLoading(true);

    // Leave the socket flow room if the savedID is present
    if (flow.savedID) {
      socket.emit("leaveFlow", flow.savedID);
    }

    setFlow(newFlowObject());
    placedIDCounter.current = 1;
    setSaved(true);

    resetHistory();

    // Clear the terminal if present
    if (window.horusTerm.ref && window.horusTerm.ref.current) {
      window.horusTerm.ref.current.clearStdout();
    }
    window.horusTerm.storedMessages = [];

    setFlowLoading(false);
  }, [flow.savedID, saved, resetHistory]);

  /**
   * Handles the undo functionality by reverting to the previous state of the flow.
   * If there are no previous states in the past array, the function does nothing.
   *
   * @returns void
   */
  const handleUndo = useCallback(() => {
    if (past.length < 1) {
      return; // If there are no previous states, do nothing
    }

    const undoTo = past[past.length - 1]; // Get the previous state to revert to

    if (undoTo === undefined) {
      return; // If the previous state is undefined, do nothing
    }

    const newPast = past.slice(0, past.length - 1); // Remove the last state from the past array

    setFuture([flow, ...future]); // Add the current state to the future array
    setPast(newPast); // Update the past array

    handleFlowChange(undoTo); // Handle the flow change to the previous state
  }, [flow, past, future, handleFlowChange]);

  /**
   * Handles the redo functionality by reverting to the next state in the future array.
   * If there are no next states in the future array, the function does nothing.
   *
   * @returns void
   */
  const handleRedo = useCallback(() => {
    // If there are no next states, do nothing
    if (future.length < 1) {
      return;
    }

    const redoTo = future[0]; // Get the next state to redo to

    // If the next state is undefined, do nothing
    if (redoTo === undefined) {
      return;
    }

    const newFuture = future.slice(1); // Remove the next state from the future array

    setPast([...past, flow]); // Add the current state to the past array
    setFuture(newFuture); // Update the future array

    handleFlowChange(redoTo); // Handle the flow change to the next state
  }, [flow, past, future, handleFlowChange]);

  const handleOpenFlow = useCallback(
    (e: CustomEvent<{ savedID: string; path: string; template: boolean }>) => {
      const hasPath = e.detail.path !== undefined;
      const hasSavedID = e.detail.savedID !== undefined;
      if (!window.horusInternal.isDesktop && !hasPath && !hasSavedID) {
        setFileProps(serverPickerFlow());
        setServerFilePickerOpen(true);
      } else {
        loadFlow(Object.keys(e.detail).length === 0 ? null : e.detail);
      }
    },
    [loadFlow, serverPickerFlow]
  );

  // For the server mode, we need to open first the file picker in folder mode
  // to select the saving folder
  const preHandleSave = useCallback(
    async (comesFromExecuteBlock: boolean = false, flowToSave?: Flow) => {
      if (window.horusInternal.mode === "webapp") {
        // On webapp mode, flows are saved on the server
        // The server assigns the path, therefore we do not need to open the file picker
        // Just pass the flow to the handleSave function
        return await handleSave(flowToSave);
      } else if (
        !window.horusInternal.isDesktop &&
        (flowToSave?.path === null || !flow.path) &&
        !flowToSave?.template
      ) {
        if (comesFromExecuteBlock === true) {
          // Alert the user that the flow needs to be saved first
          await horusAlert(
            "The flow needs to be saved first. Please select a folder to save the flow"
          );
        }

        // Open the file picker
        setFileProps(serverPickerFolder());
        setServerFilePickerOpen(true);
        return;
      } else {
        return await handleSave(flowToSave);
      }
    },
    [handleSave, serverPickerFolder, flow.path]
  );

  const horusPrompt = usePrompt();

  const handleSaveAs = useCallback(async () => {
    const newUnsavedFlow: Flow = {
      ...flow,
      savedID: null,
      path: null,
    };

    // If we are on WebApp, ask the user for a new name
    if (window.horusInternal.mode === "webapp") {
      const newName = await horusPrompt("New flow name...");

      if (!newName) {
        return;
      }

      newUnsavedFlow.name = newName;
    }

    await preHandleSave(false, newUnsavedFlow);
  }, [flow, preHandleSave, horusPrompt]);

  const handleSaveTemplate = useCallback(async () => {
    const newUnsavedFlow: Flow = {
      ...flow,
      savedID: null,
      path: null,
      template: true,
    };

    await preHandleSave(false, newUnsavedFlow);
  }, [flow, preHandleSave]);

  function handleMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;

    // Check that the user is clicking over the canvas and not anything else
    if (target.id === DroppableEntity.CANVAS) {
      setIsPanning(true);
      document.onselectstart = function () {
        return false;
      };
      initialPanPosition.current = {
        x: e.clientX,
        y: e.clientY,
      };
    }
  }

  function handleMousePan(evt: MouseEvent) {
    // Move all blocks by delta
    if (isPanning) {
      // Get mouse delta
      const deltaX = (evt.clientX - initialPanPosition.current.x) * (1 / scale);
      const deltaY = (evt.clientY - initialPanPosition.current.y) * (1 / scale);

      initialPanPosition.current = {
        x: evt.clientX,
        y: evt.clientY,
      };

      moveBlocksPan(deltaX, deltaY);
    }
  }

  const moveBlocksPan = useCallback(
    (deltaX: number, deltaY: number) => {
      const newBlocks: Block[] = flow.blocks.map((block: Block) => {
        return {
          ...block,
          position: {
            x: block.position.x + deltaX,
            y: block.position.y + deltaY,
          },
        };
      });

      setFlow({
        ...flow,
        blocks: newBlocks,
      });
    },
    [flow, setFlow]
  );

  const centerView = useCallback(() => {
    // Set the first block to be at the center of the canvas
    // Then move all blocks by delta respective to the first block

    const firstBlockPos = flow.blocks[0]?.position;

    if (!firstBlockPos) {
      return;
    }

    // Get the center of the canvas
    const canvas = document.getElementById(DroppableEntity.SCALED_CANVAS);

    if (!canvas) {
      return;
    }

    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;

    const canvasCenter = {
      x: canvasWidth - convertRemToPixels(10),
      y: canvasHeight - convertRemToPixels(3),
    };

    const delta = {
      x: -firstBlockPos.x + canvasCenter.x,
      y: -firstBlockPos.y + canvasCenter.y,
    };

    moveBlocksPan(delta.x, delta.y);
    setScale(1);
  }, [flow.blocks, moveBlocksPan, setScale]);

  function handleMouseUp(element: MouseEvent) {
    const canvas = document.getElementById(DroppableEntity.CANVAS);

    if (!canvas) {
      return;
    }

    const canvasRect = canvas.getBoundingClientRect();

    // Set the mouse position to the current position
    mousePos.current = {
      x: element.clientX - canvasRect.left,
      y: element.clientY - canvasRect.top,
    };

    setIsPanning(false);
    document.onselectstart = function () {
      return true;
    };
  }

  function setBlockInputGroup(placedID: number, inputGroup: string) {
    const updatedBlocks = flow.blocks.map((block) => {
      if (block.placedID === placedID) {
        return {
          ...block,
          selectedInputGroup: inputGroup,
        };
      }
      return block;
    });

    handleBlockChanges(updatedBlocks);
  }

  // Take into account if we are inside the executeFlow function
  // in order to not update the flow from the socket
  // This will prevent overwriting the flow status
  const isExecutingInProcess = useRef(false);

  const latestPath = useRef<string | null>(null);

  async function executeFlow(placedID: number, resetFlow: boolean = false) {
    if (isExecutingInProcess.current) {
      return;
    }

    try {
      isExecutingInProcess.current = true;

      // Check that the flow is saved
      if (!(await preHandleSave(true))) {
        return;
      }

      // Make sure we have joined the flow room
      socket.emit("joinFlow", flow.savedID);

      setFlowText("Submitting flow");
      setFlowLoading(true);

      const updatedFlowPath = flow.path ?? latestPath.current;

      setFlow((currentFlow) => {
        return {
          ...currentFlow,
          status: FlowStatus.QUEUED,
        } as Flow;
      });

      if (resetFlow) {
        // Clear the terminal if present
        window.horusTerm.ref?.current?.clearStdout();
        window.horusTerm.storedMessages = [];
      }

      const response = await horusPost(
        "/api/plugins/executeflow",
        null,
        JSON.stringify({
          flowPath: updatedFlowPath,
          placedID: placedID,
          resetFlow: resetFlow,
        })
      );

      const result = await response.json();

      if (!result.ok) {
        await horusAlert(result.msg);
        setFlow({
          ...flow,
          status: FlowStatus.ERROR,
        });
      }

      setFlowLoading(false);
    } finally {
      isExecutingInProcess.current = false;
    }
  }

  async function stopFlow() {
    if (
      !(await horusConfirm("Are you sure you want to stop executing the flow?"))
    ) {
      return;
    }

    // Make sure we have joined the flow room
    socket.emit("joinFlow", flow.savedID);

    const stoppedFlow = {
      ...flow,
      status: FlowStatus.CANCELLING,
    };

    setFlow(stoppedFlow);

    const body = JSON.stringify({
      flowPath: flow.path,
    });

    const response = await horusPost("/api/plugins/stopflow", null, body);

    const data = await response.json();

    if (!data.ok) {
      await horusAlert(data.msg);
    }
  }

  function setBlockRemote(placedID: number, selectedRemote: string) {
    const blockToUpdate = findBlocks([placedID]);

    if (!blockToUpdate) {
      return;
    }

    const newBlock: Block = {
      ...blockToUpdate[0]!,
      selectedRemote: selectedRemote,
    };

    handleBlockChanges([newBlock], false, true, false);
  }

  useEffect(() => {
    socket.on("flow", loadSocketFlow);

    return () => {
      socket.off("flow", loadSocketFlow);
    };
  }, [loadSocketFlow]);

  const [showFileExplorer, setShowFileExplorer] = useState(false);

  const toggleFileExplorer = () => {
    setShowFileExplorer((currentShowFileExplorer) => !currentShowFileExplorer);
  };

  const resetFlow = useCallback(async () => {
    if (!flow.path) {
      return;
    }

    if (!(await horusConfirm("Are you sure you want to reset the flow?"))) {
      return;
    }

    const savedFlow = await preHandleSave();
    if (!savedFlow) return;
    try {
      const body = JSON.stringify({
        flowPath: flow.path,
      });

      const response = await horusPost("/api/resetflow", null, body);

      const data = await response.json();

      if (!data.ok) {
        horusAlert(data.msg);
      }
    } catch (error) {
      // @ts-ignore
      horusAlert(error);
    }
  }, [flow.path, preHandleSave]);

  // Remove the event listeners
  const removeListeners = useCallback(() => {
    window.removeEventListener("newFlow", handleNewFlow);

    // @ts-ignore
    window.removeEventListener("openFlow", handleOpenFlow);
    // @ts-ignore
    window.removeEventListener("saveFlow", preHandleSave);
    window.removeEventListener("saveFlowAs", handleSaveAs);
    window.removeEventListener("saveTemplate", handleSaveTemplate);
    window.removeEventListener("centerView", centerView);
    window.removeEventListener("resetFlow", resetFlow);

    window.removeEventListener("undo", handleUndo);
    window.removeEventListener("redo", handleRedo);
    window.removeEventListener("toggleFileExplorer", toggleFileExplorer);
  }, [
    handleNewFlow,
    handleOpenFlow,
    preHandleSave,
    handleSaveAs,
    handleSaveTemplate,
    centerView,
    resetFlow,
    handleUndo,
    handleRedo,
  ]);

  const addListeners = useCallback(() => {
    // Add an event listeners for flow control
    window.addEventListener("undo", handleUndo);
    window.addEventListener("redo", handleRedo);

    // Add an event listener to clear all the state when the "New" button is clicked in the toolbar
    window.addEventListener("newFlow", handleNewFlow);

    // Add an event listener to open a flow when the "Open" button is clicked in the toolbar
    // @ts-ignore
    window.addEventListener("openFlow", handleOpenFlow);

    // Add an event listener to save a flow when the "Save" button is clicked in the toolbar
    // @ts-ignore
    window.addEventListener("saveFlow", preHandleSave);

    // Add an event listener to save a flow when the "Save As.." button is clicked in the toolbar
    window.addEventListener("saveFlowAs", handleSaveAs);

    // Add an event listener to save a flow as a template
    window.addEventListener("saveTemplate", handleSaveTemplate);

    // Add an event listener for the center view button
    window.addEventListener("centerView", centerView);

    // Add an event listener for the reset flow button
    window.addEventListener("resetFlow", resetFlow);

    // Event for the fileExplorer
    window.addEventListener("toggleFileExplorer", toggleFileExplorer);
  }, [
    handleUndo,
    handleRedo,
    handleNewFlow,
    handleOpenFlow,
    preHandleSave,
    handleSaveAs,
    handleSaveTemplate,
    centerView,
    resetFlow,
  ]);

  useEffect(() => {
    // Update the window.horus.getFlow function
    window.horus.getFlow = () => {
      return { ...flow, saved: saved };
    };

    // Update the window.horus.setFlow function
    window.horus.setFlow = (flow: Flow) => {
      setFlow(flow);
    };

    // When the socket.io connects, we need to join the flow room
    // In case the server was lost, socket.io will try to reconnect
    // therefore we need to join the room again so that the flow is always
    // updated

    // Update the flow event listeners
    removeListeners();
    addListeners();

    // Clean the event listener when the component is unmounted
    return () => {
      removeListeners();
    };
  }, [flow, scale, saved, addListeners, removeListeners]);

  // Fetch the remotes only one time after the component is mounted
  useEffect(() => {
    fetchRemotes();
  }, []);

  return {
    flow: {
      flow,
      flowText,
      blockConnections,
      saved,
      placedIDCounter,
      flowLoading,
      isFlowActive,
      scale,
      loadFlow,
      handleSave,
      handleFlowChange,
      stopFlow,
      centerView,
      handleScaleChange,
    },
    block: {
      connectingVariable,
      remotesOptions,
      executeFlow,
      handleDelete,
      unconnectVariables,
      updateCyclesCount,
      setBlockInputGroup,
      handleBlockChanges,
      setBlockRemote,
    },
    dnd: {
      dndTweaks,
      draggingBlock,
      handleDragEnd,
      handleDragStart,
    },
    handleMouse: {
      handleMouseDown,
      handleMousePan,
      handleMouseUp,
      handleMouseMove,
      isPanning,
    },
    misc: {
      fileProps,
      // File explorer for opening / saving .flows
      serverFilePickerOpen,
      setServerFilePickerOpen,
      // This second file explorer is only for browsing, uploading, removing files...
      showFileExplorer,
      setShowFileExplorer,
    },
  };
}

export type FlowBuilderHooks = ReturnType<typeof useFlowBuilder>;
export type FlowHooks = FlowBuilderHooks["flow"];
export type BlockHooks = FlowBuilderHooks["block"];
export type DndHooks = FlowBuilderHooks["dnd"];
export type HandleMouseHooks = FlowBuilderHooks["handleMouse"];
