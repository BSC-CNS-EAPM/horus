// React
import {
  useRef,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useContext
} from "react";
import type { DragEvent, PointerEvent } from "react";
import { DockviewApi } from "dockview";

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
  SensorOptions
} from "@dnd-kit/core";

// Horus web-server
import {
  delay,
  fetchWithProgress,
  horusGet,
  horusPost,
  POSTUploadWithProgress
} from "../../Utils/utils";
import { socket } from "../../Utils/socket";

// Types
import {
  Block,
  BlockVarPair,
  DraggableEntity,
  DroppableEntity,
  Flow,
  FlowStatus,
  FlowStatusUtil,
  VariableConnection
} from "./flow.types";
import { FileExplorerProps } from "../FileExplorer/file_explorer";
import { usePrompt } from "../HorusPrompt/horus_prompt";
import { useAlert } from "../HorusPrompt/horus_alert";
import { useConfirm } from "../HorusPrompt/horus_confirm";
import {
  HorusSmilesManagerState,
  SmilesEvents
} from "../Smiles/SmilesWrapper/horusSmiles";
import { useLocation } from "react-router";
import {
  addBlockRegistryGroup,
  addPanel,
  closeAllPanels,
  FlowBuilderContext,
  PANEL_REGISTRY
} from "../MainApp/PanelView";
import { navigateTo } from "@/Utils/navigationService";
import {
  isMolstarLoaded,
  MolstarEvents
} from "../Molstar/HorusWrapper/horusmolstar";
import { LogsData } from "./Logs/logs_connections";
import { blockLogsPanelID } from "./Blocks/block.hooks";
import { GLOBAL_IDS } from "@/Utils/globals";

export type SaveStatus = "saved" | "saving" | "error" | "idle";

export enum FlowEvents {
  FLOW_CHANGED = "flowChanged"
}

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
      }
    }
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
    "img"
  ];

  // Disable drag on certain IDs
  const interactiveIDS = ["modal", "block-error-title"];

  // Disable drag on certain classNames
  const interactiveClassNames = ["rc-slider"];

  for (const id of interactiveIDS) {
    if (element?.id?.includes(id)) {
      return true;
    }
  }

  if (typeof element?.className === "string") {
    if (element?.className?.includes("force-drag")) {
      return false;
    }

    for (const className of interactiveClassNames) {
      if (element?.className?.includes(className)) {
        return true;
      }
    }
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
      y: block.position.y + delta.y * (1 / scale)
    }
  };

  return newBlock;
}

/**
 * Custom hook for DND tweaks.
 *
 * @returns An object containing the sensors and measuring configuration for DND.
 */
export function useDNDTweaks(): {
  sensors: SensorDescriptor<SensorOptions>[];
  measuring: MeasuringConfiguration;
} {
  // DND tweaks
  const mouseSensor = useSensor(SmartPointerSensor, {
    activationConstraint: {
      distance: 5
    }
  });

  const sensors = useSensors(mouseSensor);

  const measuring: MeasuringConfiguration = {
    droppable: {
      measure: getClientRect
    }
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
    pendingExtensions: [],
    flowError: "",
    elapsed: 0
  };
}

type DevelopmentIframeVariableGetter = {
  iframe_id: string;
  variable_id: string;
  variable_placedID: number;
  panel_id: string;
};

// Create a new flow builder hook
const SAVE_SUCCESS_DISPLAY_DURATION_MS = 2000;
// Duration for displaying save error status (ms)
const SAVE_ERROR_DISPLAY_DURATION_MS = 5000;

export function useFlowBuilder({ dockApi }: { dockApi: DockviewApi | null }) {
  // Initialize the drag and drop tweaks
  const dndTweaks = useDNDTweaks();

  //
  const [developmentIframes, setDevelopmentIframes] = useState<
    DevelopmentIframeVariableGetter[]
  >([]);

  // Store the state of the flow
  const [flow, setFlow] = useState<Flow>(newFlowObject());

  useEffect(() => {
    if (dockApi) {
      const flowPanel = dockApi.getPanel("flow");
      flowPanel?.api.updateParameters({ status: flow.status });
      flowPanel?.api.setTitle(flow.name);
    }
  }, [flow, dockApi]);

  const saved = flow.status !== FlowStatus.UNSAVED;

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
    return FlowStatusUtil.RUNNING_STATUSES().includes(flow.status);
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
    (callBack: (lastValue: Flow) => Flow, updateHistory: boolean = false) => {
      // Do not modify the flow if it is active
      if (isFlowActive) {
        return;
      }

      setFlow((prev) => {
        const newFlow = callBack(prev);
        const handledFlow: Flow = { ...newFlow, status: FlowStatus.UNSAVED };

        if (updateHistory) {
          handleHistoryChange(prev);
        }

        return handledFlow;
      });
    },
    [isFlowActive]
  );

  const updateMolstarState = useCallback(
    async (options?: {
      savedPath?: string;
      savedID?: string;
      showProgress?: boolean;
    }) => {
      // Check that the flow has a valid path and
      // that Mol* is mounted

      const pathToUse = options?.savedPath ?? flow.path;
      const savedID = options?.savedID;
      const showProgress = options?.showProgress ?? true;

      if (!pathToUse || !savedID) {
        return;
      }

      try {
        // Save the mol* and smiles state
        const formData = new FormData();
        formData.append("flowPath", pathToUse);
        formData.append("savedID", savedID);

        if (isMolstarLoaded(window.molstar)) {
          const molstarState = await window.molstar.snapshot.get();
          formData.append("molstarState", molstarState, "molstarState.molx");
        }

        if (window.smiles) {
          const smilesState = await window.smiles.saveState();
          const smilesStateFile = new File(
            [JSON.stringify(smilesState)],
            "smilesState.json"
          );
          formData.append("smilesState", smilesStateFile, "smilesState.json");
        }

        // Use the helper function to upload with progress tracking
        // No-op callback for auto-save when progress tracking is not needed
        const data: any = showProgress
          ? await POSTUploadWithProgress(
              "/api/updatemolstate",
              formData,
              (percentage) => {
                setFlowText(`Saving structures: ${percentage.toFixed(0)}%`);
              }
            )
          : await POSTUploadWithProgress(
              "/api/updatemolstate",
              formData,
              () => {} // No progress tracking for auto-save
            );

        if (!data.ok) {
          throw new Error(data.msg);
        }

        // Empty the pending actions
        setFlow((currentFlow) => {
          return {
            ...currentFlow,
            pendingActions: [],
            pendingSmilesActions: [],
            pendingExtensions: []
          };
        });
      } catch (e) {
        if (showProgress) {
          await horusAlert("Error updating Mol* state: " + e);
        } else {
          console.error("Error updating Mol* state during auto-save:", e);
        }
      }
      // Disable horusAlert and horusConfirm hook warning
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [flow]
  );

  const downloadMolstarState = useCallback(
    async (flowPath?: string, savedID?: string | null) => {
      if (!isMolstarLoaded(window.molstar)) return;

      const molstar = window.molstar;

      const flowToOpen = flowPath ?? flow.path;

      // Check that the flow has a valid path and
      // that Mol* is mounted
      if (!flowToOpen) {
        return;
      }

      await fetchWithProgress(
        "/api/getmolstate",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify({ flowPath: flowToOpen, savedID })
        },
        (percentage) => {
          if (percentage === 100) {
            setFlowText("Applying Mol* state...");
          } else {
            setFlowText(`Reading Mol* state... (${percentage.toFixed(0)}%)`);
          }
        }
      )
        .then(async (response) => {
          // Determine the content type of the response
          const contentType = response.headers.get("Content-Type");

          if (!contentType) {
            throw new Error("Content-Type header is missing.");
          }

          if (contentType.includes("application/json")) {
            // If the response is JSON, parse it as JSON
            response.json().then((data) => {
              if (!data.ok) {
                horusAlert("Error reading Mol* state: " + data.msg);
              }
            });
          } else if (contentType.includes("application/octet-stream")) {
            // If the response is a file (binary data), handle it as a Blob
            await response.blob().then(async (blob) => {
              await molstar.snapshot?.set(blob);
            });
          } else {
            horusAlert("Error downloading Mol* state: Invalid content type.");
            // Handle unknown content type
          }
        })
        .catch((error) => {
          horusAlert("Error downloading Mol* state: " + error);
        });

      // Disable horusAlert and horusConfirm hook warning
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [flow.path]
  );

  const internalLoadFlow = useCallback(
    async (openedFlow: Flow, isDefault: boolean) => {
      // Exit the socket flow room
      socket.emit("leaveFlow", flow.savedID);

      // Connect to a socketio room with the flowID
      socket.emit("joinFlow", openedFlow.savedID);

      // Set the placedIDCounter
      // Search for the highest placedID in the blocks and subblocks
      const placedIDs =
        openedFlow.blocks.length > 0
          ? openedFlow.blocks.map((b) => b.placedID)
          : [0];
      placedIDCounter.current = Math.max(...placedIDs) + 1;

      const appliedActions = await applyActions(openedFlow);

      if (openedFlow.flowError) {
        alert(openedFlow.flowError);
      }

      // Set the flow state and clean the pending actions
      setFlow({
        ...openedFlow,
        status: isDefault ? FlowStatus.UNSAVED : openedFlow.status,
        pendingActions: [],
        pendingExtensions: [],
        pendingSmilesActions: [],
        flowError: ""
      });

      if (appliedActions) {
        // Save the mol* state after applying the actions (will clear the extensionActions too)
        await updateMolstarState();
      }
    },
    [flow.savedID, updateMolstarState]
  );

  const isLoadingFlow = useRef<boolean>(false);

  const loadFlow = useCallback(
    async (
      openRecent: {
        savedID: string | null;
        path?: string;
        template?: boolean;
      } | null = null,
      openFile?: File
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

      // Always focus the flow panel when opening a flow
      let flowPanel = dockApi?.getPanel("flow");

      // if the panel does not exists, create it
      if (!flowPanel) {
        flowPanel = addPanel({
          dockApi: dockApi,
          component: PANEL_REGISTRY.flow.component,
          panelID: PANEL_REGISTRY.flow.id
        });
      }

      flowPanel?.focus();

      isLoadingFlow.current = true;
      setFlowText("Opening flow...");
      setFlowLoading(true);

      // Wait a second for the animation to play
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        // Define the initial data to open the flow
        let data: {
          ok: boolean;
          flow: Flow | null;
          msg: string;
          molstarState: Blob | null;
          smilesState: string | null;
        } = {
          ok: false,
          flow: null,
          msg: "Early error opening flow",
          molstarState: null,
          smilesState: null
        };

        // If a default flow is being opened, some variables need to be set
        let isDefaultFlow = openFile ? true : false;

        // If the flow is being opened from the recent flows list, use the savedID
        let response: Response;
        if (openRecent !== null) {
          const header = {
            "Content-Type": "application/json",
            Accept: "application/json"
          };

          if (!openRecent.path || openRecent.template) {
            isDefaultFlow = true;
          }

          const body = JSON.stringify({
            savedID: openRecent.savedID,
            path: openRecent.path,
            template: openRecent.template
          });

          // Using fetchWithProgress to fetch with download progress
          response = await fetchWithProgress(
            "/api/openrecentflow",
            {
              method: "POST",
              headers: header,
              body: body
            },
            (percentage) => {
              setFlowText(`Reading data... (${percentage.toFixed(0)}%)`);
            }
          );
        } else if (openFile) {
          const body = new FormData();

          body.append("file", openFile);

          response = await fetchWithProgress(
            "/api/flowfile",
            {
              method: "POST",
              body: body
            },
            (percentage) => {
              setFlowText(
                `Verifying dropped flow... (${percentage.toFixed(0)}%)`
              );
            }
          );
        } else {
          // Using fetchWithProgress to fetch with download progress
          response = await fetchWithProgress(
            "/api/openflow",
            {
              method: "GET"
            },
            (percentage) => {
              setFlowText(`Reading data... (${percentage.toFixed(0)}%)`);
              // Here you can update a UI element or do something else with the progress
            }
          );
        }

        // Read the response. This will call the onProgress callback
        data = await response
          .json()
          .then((data) => data)
          .catch((error) => {
            return {
              ok: false,
              msg: `Failed to open flow. ${
                error instanceof Error ? error.message : error
              }.`
            };
          });

        if (!data.ok) {
          await horusAlert(data.msg);
          return;
        }

        const openedFlow = data.flow;

        if (!openedFlow) {
          return;
        }

        // Load the panels
        const serializedPanels = openedFlow.panels;
        if (serializedPanels && dockApi) {
          setFlowText("Restoring panels...");
          try {
            dockApi.fromJSON(serializedPanels);

            // Remove panels associated with block variables, as when restored, they will lack
            // the onChange handler and other properties related to the block
            const removeComponents = [
              PANEL_REGISTRY.blockLogs.component,
              PANEL_REGISTRY.blockVariables.component,
              PANEL_REGISTRY.blockVariablesExtension.component,
              PANEL_REGISTRY.codeEditor.component,
              PANEL_REGISTRY.horusPlugins.component,
              PANEL_REGISTRY.horusRemotes.component,
              PANEL_REGISTRY.horusSettings.component
            ];
            dockApi.panels.map((panel) => {
              if (removeComponents.includes(panel.api.component)) {
                dockApi.removePanel(panel);
              }
            });
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            horusAlert("Failed to restore panels");
          }
        }

        // If smiles state, open it
        if (window.smiles && data.smilesState) {
          setFlowText("Loading SMILES state...");
          try {
            // Parse the smiles only if its a string
            // Skip if already an object
            let smilesState: HorusSmilesManagerState | string =
              data.smilesState;

            if (typeof smilesState === "string") {
              smilesState = JSON.parse(smilesState) as HorusSmilesManagerState;
            }

            window.smiles.restoreState(smilesState);
            await delay(500);
          } catch (error) {
            await horusAlert(`Failed to load SMILES state. ${error}`);
          }
        }

        // Set the molstar state at the beggining in case blocks need structures
        // If it has the new molstar state, open it
        if (isMolstarLoaded(window.molstar)) {
          setFlowText("Loading Mol* state...");
          await downloadMolstarState(openedFlow.path!, openedFlow?.savedID);
          await delay(500);
        }

        // If we are dropping a file, do not set the path
        // Except for App mode, in that case leave the path
        if (
          (openFile && !window.horusInternal.isDesktop) ||
          openedFlow.isPreset
        ) {
          openedFlow.path = null;
        }

        setFlowText("Loading blocks...");
        await internalLoadFlow(openedFlow, isDefaultFlow);

        // Reset the history
        resetHistory();
      } finally {
        setFlowLoading(false);
        isLoadingFlow.current = false;
      }
    },
    // Disable horusAlert and horusConfirm hook warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [saved, resetHistory, internalLoadFlow, dockApi]
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
          path: path
        });
      }
    };
  }, [loadFlow]);

  const [fileProps, setFileProps] =
    useState<FileExplorerProps>(serverPickerFlow());

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

  const serializeFlow = useCallback((): Flow => {
    return {
      ...flow
    };
  }, [flow]);

  const isSaving = useRef<boolean>(false);
  const isAutoSaving = useRef<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const autoSaveTimeoutRef = useRef<number | null>(null);
  const saveStatusTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
        saveStatusTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Core save functionality that can be used by both manual and auto saves
   */
  const saveFlowCore = useCallback(
    async (
      flowToSave: Flow,
      showModal: boolean = true
    ): Promise<Flow | null> => {
      const saveContents: Flow = {
        ...flowToSave,
        status: FlowStatus.IDLE,
        panels: dockApi?.toJSON()
      };

      try {
        // Prepare the body for the save request
        const body = new FormData();
        const flowFile = new File([JSON.stringify(saveContents)], "flow.json", {
          type: "application/json"
        });
        body.append("flowData", flowFile);

        // Post the flow to the server
        const response = await horusPost(
          "/api/saveflow",
          undefined,
          body,
          undefined
        );

        // Read the response
        let savedFlow = await response.json();

        if (!savedFlow) {
          if (showModal) await horusAlert("No response from the server");
          return null;
        }

        if (!savedFlow.ok) {
          if (showModal && savedFlow?.msg) await horusAlert(savedFlow.msg);
          return null;
        }

        // Handle overwrite for manual saves only
        const overwrite = savedFlow.overwrite;
        const existingName = savedFlow.existingName;
        const path = overwrite ? savedFlow.path : saveContents.path;
        const desktop = savedFlow.desktop;

        // Check if the flow with the same name already exists (only for manual saves)
        if (
          showModal &&
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
          const overwriteContents = {
            ...saveContents,
            name: existingName,
            path: path,
            overwrite: true
          };

          const overwriteBody = new FormData();
          const overwriteFile = new File(
            [JSON.stringify(overwriteContents)],
            "flow.json",
            { type: "application/json" }
          );

          overwriteBody.append("flowData", overwriteFile);

          const overwriteResponse = await horusPost(
            "/api/saveflow",
            undefined,
            overwriteBody,
            undefined
          );

          savedFlow = await overwriteResponse.json();

          if (!savedFlow.ok) {
            if (showModal) await horusAlert(savedFlow.msg);
            return null;
          }
        }

        // Update flow state
        socket.emit("leaveFlow", saveContents.savedID);

        setFlow({
          ...saveContents,
          savedID: savedFlow.savedID,
          path: savedFlow.path,
          status: FlowStatus.IDLE
        });

        latestPath.current = savedFlow.path;

        // Join the room with the new savedID
        socket.emit("joinFlow", savedFlow.savedID);

        // Update the URL with the flowID
        const newURL = `${window.__HORUS_ROOT__}/flow?open=true&flowID=${savedFlow.savedID}&path=${savedFlow.path}`;
        window.history.replaceState({}, document.title, newURL);

        // Update the molstar state for all saves
        if (showModal) {
          setFlowText("Getting structures state...");
        }
        await updateMolstarState({
          savedPath: savedFlow.path,
          savedID: savedFlow.savedID,
          showProgress: showModal
        });

        return savedFlow as Flow;
      } catch (error) {
        if (showModal) {
          alert(`Error saving the flow: ${error}`);
        }
        return null;
      }
    },
    // Disable horusAlert and horusConfirm hook warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [serializeFlow, handleFlowChange, saved, dockApi, updateMolstarState]
  );

  // Duration for displaying save error status (ms)
  const handleAutoSave = useCallback(async (): Promise<boolean> => {
    if (
      isFlowActive ||
      !flow.path ||
      isSaving.current ||
      isAutoSaving.current
    ) {
      return false;
    }

    // Don't auto-save if flow is already saved
    if (saved) {
      return true;
    }

    isAutoSaving.current = true;
    setSaveStatus("saving");

    try {
      const result = await saveFlowCore(serializeFlow(), false);

      if (result) {
        setSaveStatus("saved");
        // Auto-hide saved status after SAVE_SUCCESS_DISPLAY_DURATION_MS
        if (saveStatusTimeoutRef.current) {
          window.clearTimeout(saveStatusTimeoutRef.current);
          window.clearTimeout(saveStatusTimeoutRef.current);
        }
        saveStatusTimeoutRef.current = window.setTimeout(() => {
          setSaveStatus("idle");
        }, SAVE_SUCCESS_DISPLAY_DURATION_MS);
        return true;
      } else {
        setSaveStatus("error");
        // Auto-hide error status after SAVE_ERROR_DISPLAY_DURATION_MS
        if (saveStatusTimeoutRef.current) {
          window.clearTimeout(saveStatusTimeoutRef.current);
        }
        saveStatusTimeoutRef.current = window.setTimeout(() => {
          setSaveStatus("idle");
        }, SAVE_ERROR_DISPLAY_DURATION_MS);
        return false;
      }
    } catch (error) {
      console.error("Auto-save failed:", error);
      setSaveStatus("error");
      // Auto-hide error status after SAVE_ERROR_DISPLAY_DURATION_MS
      if (saveStatusTimeoutRef.current) {
        window.clearTimeout(saveStatusTimeoutRef.current);
      }
      saveStatusTimeoutRef.current = window.setTimeout(() => {
        setSaveStatus("idle");
      }, SAVE_ERROR_DISPLAY_DURATION_MS);
      return false;
    } finally {
      isAutoSaving.current = false;
      // Remove saveFlowCore from dependency array to prevent unnecessary recreations
    }
  }, [isFlowActive, flow.path, saved, serializeFlow, saveFlowCore]);
  /**
   * Saves the flow data to the server (for manual saves).
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
      setFlowText("Saving flow...");
      setFlowLoading(true);

      try {
        const result = await saveFlowCore(
          flowToSave ? flowToSave : serializeFlow(),
          true
        );
        return result;
      } finally {
        // Reset the state of the loading flow when everything is done
        isSaving.current = false;
        setFlowLoading(false);
      }
    },
    [serializeFlow, saveFlowCore]
  );

  const serverPickerFolder = useCallback(
    (flowName?: string) => {
      return {
        openFolder: true,
        onFileSelect: () => {},
        onFileConfirm: async (path: string) => {
          const flowToSave = { ...flow, name: flowName ?? flow.name };
          const strippedFlowName = flowToSave.name.replace(
            /[^a-zA-Z0-9]/g,
            "_"
          );

          // append the flow name
          flowToSave.path = path + "/" + strippedFlowName + ".flow";
          flowToSave.savedID = null;

          // Save the flow
          await handleSave(flowToSave);
        }
      };
    },
    [flow, handleSave]
  );

  // Helper function that should be called every time any block changes
  // It updates the flow state and the saved state efficiently
  const handleBlockChanges = useCallback(
    (
      newBlocks: Block[],
      isNew: boolean = false,
      updateHistory: boolean = false,
      resetExecution: boolean = true
    ) => {
      handleFlowChange((prev) => {
        const updatedBlocks = isNew
          ? [...prev.blocks, ...newBlocks]
          : prev.blocks.map((block: Block) => {
              const matchingNewBlock = newBlocks.find(
                (newBlock: Block) => newBlock.placedID === block.placedID
              );

              if (matchingNewBlock) {
                return {
                  ...matchingNewBlock,
                  finishedExecution: resetExecution
                    ? false
                    : block.finishedExecution
                } as Block;
              }

              return block;
            });

        return {
          ...prev,
          blocks: updatedBlocks
        } satisfies Flow;
      }, updateHistory);
    },
    [handleFlowChange]
  );

  // Helper function that efficiently returns the blocks with the given placedID
  const findBlocks = useCallback(
    (blockIDs: Array<number>): Array<Block> | null => {
      // Map the blocks by their placedID
      const blockMap = new Map<number, Block>();
      flow.blocks.forEach((block) => blockMap.set(block.placedID, block));

      // Generate a new list based on the map
      const found = blockIDs
        .map((blockID) => blockMap.get(blockID))
        .filter(Boolean) as Block[];

      return found.length > 0 ? found : null;
    },
    [flow]
  );

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
      y: mousePos.current.y / scale - convertRemToPixels(3)
    };

    const newBlock: Block = {
      ...block,
      isPlaced: true,
      placedID: placedIDCounter.current,
      position: position,
      variables: block.variables.map((variable) => {
        return {
          ...variable,
          placedID: placedIDCounter.current
        };
      })
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

  // Drag & drop flows
  const [isDraggingFlowFile, setIsDraggingFlowFile] = useState(false);

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();

    if (event.dataTransfer.types[0] === "Files") {
      // If its dragging a .flow file,
      // set the overlay to active
      setIsDraggingFlowFile(true);
    }
  };

  const handleDragDropEnd = (event: DragEvent<HTMLDivElement>) => {
    setIsDraggingFlowFile(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    setIsDraggingFlowFile(false);
    event.preventDefault();

    // Send the file to the backend and open an "unsaved" flow
    const file = event.dataTransfer.files[0];

    if (file && file.name.endsWith(".flow")) {
      loadFlow(null, file);
    }
  };

  const handleDelete = async (block: Block) => {
    dockApi?.panels.map((panel) => {
      if (panel?.params?.["placedID"] === block.placedID) {
        dockApi?.removePanel(panel);
      }
    });

    // Check first if the block to delete is connected to a variable wich also
    // has a cyclic connection
    for (const variableConnection of block.variableConnections) {
      if (variableConnection.isCyclic) {
        await horusAlert("Remove the cyclic connection first");
        return;
      }
    }

    // Update the flow
    handleFlowChange((prev) => {
      for (const variableReference of block.variableConnectionsReference) {
        const connectedBlock = prev.blocks.find(
          (b) => b.placedID === variableReference.destination.placedID
        );

        // If the connected block is not found, continue
        if (!connectedBlock) {
          continue;
        }

        const cyclic = checkCyclicFlow(block, connectedBlock);

        if (cyclic) {
          alert("Remove the cyclic connection first");
          return prev;
        }
      }

      let updatedBlocks = prev.blocks;
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
      updatedBlocks = updatedBlocks.filter(
        (b) => b.placedID !== block.placedID
      );

      return { ...prev, blocks: updatedBlocks } satisfies Flow;
    }, true);
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
      currentCycle: 0
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
          })
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
      connection.destination.placedID
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
      })
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
        })
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
          currentCycle: 0
        }
      ]
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
          currentCycle: 0
        }
      ]
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

        if (
          currentFlow.status === FlowStatus.CANCELLING &&
          recivedFlow.status === FlowStatus.RUNNING
        ) {
          return currentFlow;
        }
        // Do not update the position of the blocks
        // This is because the user might be panning the view
        // during the flow execution
        const parsedFlow: Flow = {
          ...recivedFlow,
          blocks: recivedFlow.blocks.map((block) => {
            const newBlock = {
              ...block,
              position: currentFlow.blocks.find(
                (b) => b.placedID === block.placedID
              )?.position ?? { x: 0, y: 0 }
            };

            // Update the params if the blocklogs panel is opened
            const panel = dockApi?.getPanel(blockLogsPanelID(newBlock));
            panel?.api.updateParameters({ block: newBlock });

            return newBlock;
          })
        };

        (async () => {
          // Check for any pending actions if the flow has finished
          if (recivedFlow.status !== FlowStatus.RUNNING) {
            preventMoleculeChangedListener.current = true;
            if (await applyActions(recivedFlow)) {
              // Save the mol* state after applying the actions
              // Wait artificially 500ms for the mol* state to be updated
              await new Promise((resolve) => setTimeout(resolve, 500));
              await updateMolstarState();
            }
            preventMoleculeChangedListener.current = false;
          }
        })();

        if (parsedFlow.flowError && !hideFlowError.current) {
          alert(parsedFlow.flowError);
        }

        // Reset the hide flow error
        if (hideFlowError.current) {
          hideFlowError.current = false;
        }

        return {
          ...parsedFlow,
          pendingActions: [],
          pendingExtensions: [],
          pendingSmilesActions: [],
          flowError: ""
        };
      });
    },

    [updateMolstarState, dockApi]
  );

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

    resetHistory();

    setFlowLoading(false);

    // Clean the url
    navigateTo("/flow");

    // Reset the panels
    if (dockApi) {
      closeAllPanels({ dockApi });

      // Add back the block registry & flow panels
      addPanel({
        dockApi,
        component: PANEL_REGISTRY.flow.component,
        panelID: PANEL_REGISTRY.flow.id
      });

      addBlockRegistryGroup(dockApi);
    }

    // Disable horusConfirm hook warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.savedID, saved, resetHistory, dockApi]);

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

    handleFlowChange(() => undoTo); // Handle the flow change to the previous state
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

    handleFlowChange(() => redoTo); // Handle the flow change to the next state
  }, [flow, past, future, handleFlowChange]);

  const handleOpenFlow = useCallback(
    (props?: { path?: string; savedID?: string; template?: boolean }) => {
      if (props || !window.horusInternal.isDesktop) {
        const { path, savedID, template } = props ?? {};
        const hasPath = path !== undefined;
        const hasSavedID = savedID !== undefined;
        if (!window.horusInternal.isDesktop && !hasPath && !hasSavedID) {
          setFileProps(serverPickerFlow());
          setServerFilePickerOpen(true);
        } else {
          loadFlow({
            savedID: savedID ?? null,
            path,
            template: template
          });
        }
      } else {
        loadFlow();
      }
    },
    [loadFlow, serverPickerFlow]
  );

  // For the server mode, we need to open first the file picker in folder mode
  // to select the saving folder
  const preHandleSave = useCallback(
    async (comesFromExecuteBlock: boolean = false, flowToSave?: Flow) => {
      // If the flowBuilder pane is not opened, ask for the flow name if none defined
      if (!flow.path) {
        if (!dockApi?.getPanel(PANEL_REGISTRY.flow.id)) {
          const newName = await horusPrompt("New flow name...");

          if (!newName) {
            return;
          }

          if (flowToSave) {
            flowToSave.name = newName;
          } else {
            flowToSave = { ...flow, name: newName };
          }

          setFileProps(serverPickerFolder(newName));
          setServerFilePickerOpen(true);
          return;
        }
      }

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
    // Disable horusAlert hook warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [handleSave, serverPickerFolder, flow.path]
  );

  const horusPrompt = usePrompt();

  const handleSaveAs = useCallback(async () => {
    const newUnsavedFlow: Flow = {
      ...flow,
      savedID: null,
      path: null
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
      template: true
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
        y: e.clientY
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
        y: evt.clientY
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
            y: block.position.y + deltaY
          }
        };
      });

      setFlow({
        ...flow,
        blocks: newBlocks
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
      y: canvasHeight - convertRemToPixels(3)
    };

    const delta = {
      x: -firstBlockPos.x + canvasCenter.x,
      y: -firstBlockPos.y + canvasCenter.y
    };

    moveBlocksPan(delta.x, delta.y);
    setScale(1);
  }, [flow.blocks, moveBlocksPan, setScale]);

  function handleMouseUp(element: MouseEvent) {
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
          finishedExecution: false
        };
      }
      return block;
    });

    handleBlockChanges(updatedBlocks, false, true, false);
  }

  // Take into account if we are inside the executeFlow function
  // in order to not update the flow from the socket
  // This will prevent overwriting the flow status
  const isExecutingInProcess = useRef(false);
  const hideFlowError = useRef(false);

  const latestPath = useRef<string | null>(null);

  const executeFlow = useCallback(
    async (options?: {
      placedID?: number;
      resetFlow?: boolean;
      continueSlurm?: boolean;
    }) => {
      const {
        placedID = undefined,
        resetFlow = false,
        continueSlurm = false
      } = { ...options };

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
            status: FlowStatus.QUEUED
          } as Flow;
        });

        const response = await horusPost(
          "/api/plugins/executeflow",
          null,
          JSON.stringify({
            flowPath: updatedFlowPath,
            placedID,
            resetFlow,
            continueSlurm
          })
        );

        const result = await response.json();

        if (!result.ok) {
          await horusAlert(result.msg);
          setFlow({
            ...flow,
            status: FlowStatus.ERROR
          });
        }

        setFlowLoading(false);
      } finally {
        isExecutingInProcess.current = false;
      }
    },
    // Disable horusAlert hook warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flow, preHandleSave]
  );

  const pauseOrStopFlow = useCallback(
    async (pause: boolean = false) => {
      // Make sure we have joined the flow room
      socket.emit("joinFlow", flow.savedID);

      const stoppedFlow = {
        ...flow,
        status: pause ? FlowStatus.PAUSED : FlowStatus.CANCELLING
      };

      setFlow(stoppedFlow);

      const body = JSON.stringify({
        flowPath: flow.path,
        pause: pause
      });

      const response = await horusPost("/api/plugins/stopflow", null, body);

      const data = await response.json();

      if (!data.ok) {
        await horusAlert(data.msg);

        // Restore the previous state of the flow
        setFlow(flow);
      }
    },
    [flow, horusAlert, setFlow]
  );

  const stopFlow = useCallback(async () => {
    if (
      !(await horusConfirm("Are you sure you want to stop executing the flow?"))
    ) {
      return;
    }

    await pauseOrStopFlow();
  }, [horusConfirm, pauseOrStopFlow]);

  const pauseFlow = useCallback(async () => {
    // If the flow is not running, display an alert
    if (flow.status !== FlowStatus.RUNNING) {
      await horusAlert("The flow is not running");
      return;
    }

    if (
      !(await horusConfirm(
        "Are you sure you want to pause the flow? You can resume it later."
      ))
    ) {
      return;
    }

    await pauseOrStopFlow(true);

    // Disable horusAlert and horusConfirm hook warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pauseOrStopFlow]);

  function setBlockRemote(placedID: number, selectedRemote: string) {
    const blockToUpdate = findBlocks([placedID]);

    if (!blockToUpdate) {
      return;
    }

    const newBlock: Block = {
      ...blockToUpdate[0]!,
      selectedRemote: selectedRemote
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
        flowPath: flow.path
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

    // Disable horusAlert and horusConfirm hook warning
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.path, preHandleSave]);

  const location = useLocation();

  useEffect(() => {
    if (!dockApi) {
      return;
    }

    const urlProps = new URLSearchParams(location.search);

    if (!urlProps.has("open")) {
      return;
    }

    if (urlProps.get("flowID") === "open" || !urlProps.has("flowID")) {
      handleOpenFlow();
    } else {
      handleOpenFlow({
        savedID: urlProps.get("flowID") ?? undefined,
        path: urlProps.get("path") ?? undefined,
        template: !!urlProps.get("template")
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, dockApi]);

  const preventMoleculeChangedListener = useRef(false);

  useEffect(() => {
    const moleculeChangeListener = () => {
      setFlow((currentFlow) => {
        if (
          FlowStatusUtil.RUNNING_STATUSES().includes(currentFlow.status) ||
          preventMoleculeChangedListener.current
        ) {
          return currentFlow;
        }

        return {
          ...currentFlow,
          status: FlowStatus.UNSAVED
        };
      });
    };

    const updateMousePos = (e: MouseEvent) => {
      // Get the bounding box of the div
      const div = document.getElementById(
        GLOBAL_IDS.FLOW_BUILDER_DIV
      ) as HTMLDivElement;

      if (!div) {
        return;
      }

      const rect = div.getBoundingClientRect();

      // Calculate the center of the div
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Calculate the relative mouse position
      const relativeX = e.clientX - centerX; // X relative to the center
      const relativeY = e.clientY - centerY; // Y relative to the center

      // Update the mouse position+
      mousePos.current = {
        x: relativeX,
        y: relativeY
      };
    };

    // Add a listener for tracking the mouse position
    window.addEventListener("mousemove", updateMousePos);

    // Add the molecules listener
    window.addEventListener(MolstarEvents.STATE, moleculeChangeListener);
    window.addEventListener(SmilesEvents.STATE, moleculeChangeListener);

    return () => {
      // Remove the mouse position listener
      window.removeEventListener("mousemove", updateMousePos);

      // Remove the molecules listener
      window.removeEventListener(MolstarEvents.STATE, moleculeChangeListener);
      window.removeEventListener(SmilesEvents.STATE, moleculeChangeListener);
    };
  }, []);

  // Auto-save delay constant
  const AUTO_SAVE_DELAY_MS = 10000;

  // Auto-save effect
  useEffect(() => {
    // Clear any existing timeout
    if (autoSaveTimeoutRef.current) {
      window.clearTimeout(autoSaveTimeoutRef.current);
    }

    // Don't set auto-save for new flows or flows without a path
    if (!flow.path || saved) {
      return;
    }

    // Set up auto-save after AUTO_SAVE_DELAY_MS of inactivity
    autoSaveTimeoutRef.current = window.setTimeout(() => {
      handleAutoSave();
    }, AUTO_SAVE_DELAY_MS);

    return () => {
      if (autoSaveTimeoutRef.current) {
        window.clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [flow, saved, handleAutoSave]);

  useEffect(() => {
    // Update the window.horus.getFlow function
    window.horus.getFlow = () => {
      return flow;
    };

    // Update the window.horus.setFlow function
    window.horus.setFlow = (newFlow) => {
      setFlow({ ...newFlow });
    };

    // Update the window.horus.executeFlow function
    window.horus.executeFlow = executeFlow;

    // Add a new function to store extraData to the flow
    window.horus.setExtraData = (key: string, value: any) => {
      setFlow((currentFlow) => {
        return {
          ...currentFlow,
          extraData: {
            ...currentFlow.extraData,
            [key]: value
          }
        };
      });
    };

    // Add a new function to get extraData from the flow
    window.horus.getExtraData = (key: string) => {
      return flow.extraData?.[key];
    };

    // Emit an event "onFlowChange" when the flow changes
    const newEvent = new CustomEvent(FlowEvents.FLOW_CHANGED, {
      detail: flow
    });
    window.dispatchEvent(newEvent);

    // Add a onFlowChange function
  }, [flow, setFlow, executeFlow]);

  const updateBlockLogs = useCallback(
    (logs: LogsData) => {
      const { blockID, placedID, message } = logs;

      setFlow((currentFlow) => {
        return {
          ...currentFlow,
          blocks: currentFlow.blocks.map((b) => {
            if (blockID === b.id && placedID === b.placedID) {
              b.blockLogs += message;

              // Update the params if the blocklogs panel is opened
              const panel = dockApi?.getPanel(blockLogsPanelID(b));

              panel?.api.updateParameters({ block: b });
            }
            return b;
          })
        };
      });
    },
    [dockApi]
  );

  // Setup a socket listener for the "blockLogs" event
  useEffect(() => {
    socket.on("blockLogs", updateBlockLogs);
    return () => {
      socket.off("blockLogs", updateBlockLogs);
    };
  }, [updateBlockLogs]);

  // Fetch the remotes only one time after the component is mounted
  useEffect(() => {
    async function fetchRemotes() {
      const response = await horusGet("/api/remotes/names");
      const data = await response.json();

      if (!data.ok) {
        await horusAlert(data.msg);
        return;
      }

      setRemotesOptions(data.remotes);
    }

    fetchRemotes();

    // eslint-disable-next-line
  }, []);

  const copyFlowPath = useCallback(() => {
    if (!flow.path) {
      horusAlert("Flow has not been saved yet");
      return;
    }

    try {
      navigator.clipboard.writeText(flow.path);
      horusAlert(`Flow path '${flow.path}' copied to clipboard`);
    } catch {
      horusAlert(`Could not copy to clipboard. Flow path: '${flow.path}');
    }
      
  }, [flow.path, horusAlert]);

  return {
    flow: {
      hideFlowError,
      flow,
      flowText,
      blockConnections,
      saved,
      placedIDCounter,
      flowLoading,
      isFlowActive,
      scale,
      executeFlow,
      loadFlow,
      handleSave,
      handleFlowChange,
      stopFlow,
      centerView,
      handleScaleChange,
      saveStatus
    },
    shortcuts: {
      copyFlowPath,
      stopFlow,
      handleUndo,
      handleRedo,
      handleNewFlow,
      handleOpenFlow,
      preHandleSave,
      handleSaveAs,
      handleSaveTemplate,
      centerView,
      pauseFlow,
      resetFlow,
      toggleFileExplorer
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
      findBlocks
    },
    dnd: {
      dndTweaks,
      draggingBlock,
      handleDragEnd,
      handleDragStart
    },
    handleMouse: {
      handleMouseDown,
      handleMousePan,
      handleMouseUp,
      handleDragOver,
      handleDrop,
      handleDragDropEnd,
      isDraggingFlowFile,
      isPanning
    },
    misc: {
      fileProps,
      // File explorer for opening / saving .flows
      serverFilePickerOpen,
      setServerFilePickerOpen,
      // This second file explorer is only for browsing, uploading, removing files...
      showFileExplorer,
      setShowFileExplorer,

      // Selected development custom variable
      developmentIframes,
      setDevelopmentIframes
    }
  };
}

async function applyActions(flow: Flow) {
  // Apply any pending MolstarAPI actions if present
  let hasToUpdate = false;
  if (flow.pendingActions && flow.pendingActions.length > 0) {
    hasToUpdate = true;

    // Open the Mol* panel if not already open
    let tries = 0;
    while (!isMolstarLoaded(window.molstar) && tries < 10) {
      window?.horus?.openPanel?.("molstar");
      await new Promise((resolve) => setTimeout(resolve, 100));
      tries++;
    }

    if (isMolstarLoaded(window.molstar)) {
      for (const action of flow.pendingActions) {
        await window.molstar?.applyAction(action);
      }
    }
  }

  if (flow.pendingSmilesActions && flow.pendingSmilesActions.length > 0) {
    hasToUpdate = true;

    // Open the Smiles panel if not already open
    let tries = 0;
    while (!window?.smiles && tries < 10) {
      window?.horus?.openPanel?.("smiles");
      await new Promise((resolve) => setTimeout(resolve, 100));

      tries++;
    }

    for (const action of flow.pendingSmilesActions) {
      await window.smiles?.applyAction(action);
    }
  }

  if (flow.pendingExtensions && flow.pendingExtensions.length > 0) {
    hasToUpdate = true;
    for (const action of flow.pendingExtensions) {
      await window.horus?.addExtensions?.({ ...action, bypass: true });
    }
  }
  return hasToUpdate;
}

export function useFlowShortcuts() {
  const { shortcuts } = useContext(FlowBuilderContext)!;

  return shortcuts;
}

export type FlowBuilderHooks = ReturnType<typeof useFlowBuilder>;
export type FlowHooks = FlowBuilderHooks["flow"];
export type BlockHooks = FlowBuilderHooks["block"];
export type DndHooks = FlowBuilderHooks["dnd"];
export type HandleMouseHooks = FlowBuilderHooks["handleMouse"];
