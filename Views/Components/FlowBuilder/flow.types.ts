import { SerializedDockview } from "dockview-react";

type AllowedPlatforms = "universal" | "macos_intel" | "macos_arm" | "linux";

export type HorusPlugin = {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  minHorusVersion: string;
  maxHorusVersion: string;
  platforms: AllowedPlatforms[];
  externalURL: string;
  dependencies: Array<string>;
  blocks: Array<Block>;
  config: Array<{
    remote: string;
    config: Array<Block>;
  }>;
  default: boolean;

  // Base64 encoded logo
  logo?: string;
};

export type PluginPage = {
  name: string;
  url: string;
  description?: string;
  hidden?: boolean;
  id?: string;
  plugin?: string;
  placedID?: number;
  logo?: string;
  data?: any;
  dataID?: number;
  onFocus?: () => void;
};

export type PluginPageExtensionEvent = {
  savedID: string;
  bypass?: boolean;
} & PluginPage;

export enum PluginVariableTypes {
  ANY = "any",
  STRING = "string",
  TEXT_AREA = "text_area",
  NUMBER = "number",
  INTEGER = "integer",
  FLOAT = "float",
  BOOLEAN = "boolean",
  STRING_LIST = "string[]",
  NUMBER_LIST = "number[]",
  NUMBER_RANGE = "[number, number, number]",
  CONSTRAINED_NUMBER_RANGE = "[number, number, number, constrain]",
  FILE = "file",
  FOLDER = "folder",
  STRUCTURE = "structure",
  MULTIPLE_STRUCTURE = "multiple_structure",
  HETERORES = "heterores",
  STDRES = "stdres",
  RESIDUE = "residue",
  ATOM = "atom",
  CHAIN = "chain",
  SPHERE = "sphere",
  BOX = "box",
  SMILES = "smiles",
  GROUP = "group",
  LIST = "list",
  _LIST = "_list",
  OBJECT = "object",
  CODE = "code",
  CUSTOM = "custom",
  CHECKBOX = "checkbox",
  RADIO = "radio",
  PASSWORD = "PASSWORD",
}

export type PluginVariable = {
  name: string;
  id: string;
  description: string;
  type: PluginVariableTypes;
  value: any;
  placedID: number;
  allowedValues: Array<any>;
  defaultValue: any;
  category: string;
  disabled: boolean;
  required: boolean;
  placeholder?: string;

  // For GroupVariable
  variables?: Array<PluginVariable>;

  // Check if the variable is custom
  isCustom?: boolean;
};

export type CustomVariable = PluginVariable & {
  customPage: PluginPage;
};

export enum BlockTypes {
  BASE = "base",
  INPUT = "input",
  ACTION = "action",
  SLURM = "slurm",
  CONFIG = "config",
  GHOST = "ghost",
}

export type VariableGroup = {
  id: string;
  name: string;
  description: string;
  variables: Array<PluginVariable>;
};

export type VariableConnection = {
  origin: BlockVarPair;
  destination: BlockVarPair;
  isCyclic: boolean;
  cycles: number;
  currentCycle: number;
};

export type Block = {
  // Basic info about the block
  id: string;
  name: string;
  description: string;
  plugin: HorusPlugin;
  type: BlockTypes;
  category: string | null;

  // Variables, inputs, outputs
  variables: Array<PluginVariable>;
  inputs: Array<VariableGroup>;
  outputs: Array<PluginVariable>;
  selectedInputGroup: string;

  // DEPRECATED AND CHANGED FOR PLUGIN CONFIG
  // Block config
  // config: Array<Block>;

  // Block state
  isPlaced: boolean;
  isRunning: boolean;
  error: boolean;
  blockLogs: string;
  position: { x: number; y: number };
  placedID: number;
  isConnecting: boolean;
  tryingToConnect: PluginVariable | null;
  finishedExecution: boolean;
  extensionsToOpen: Array<PluginPage>;
  time: number;
  externalURL?: string;

  // Server execution
  storedOutputs: {
    [key: string]: any;
  };

  // Variable connections
  variableConnections: Array<VariableConnection>;

  // Variable connections reference
  // The block connected should know to what is connected
  // in order for arrow deletion to work
  variableConnectionsReference: Array<VariableConnection>;

  // Slurm blocks
  status: Status;
  jobs: SlurmJob[];

  // Remote connection
  selectedRemote: string;
};

export type SlurmJob = {
  JobId: string;
  ArrayJobId?: string;
  ArrayTaskId?: string;
  JobName: string;
  UserId: string;
  GroupId: string;
  JobState: Status;
  ExitCode: string;
  Nodes?: string;
  SubmitTime?: Date;
  StartTime?: Date;
  EndTime?: Date;
  ElapsedTime?: string;
  WorkDir?: string;
  Command?: string;
  StdoutPath?: string;
  StderrPath?: string;
  StdOutContent?: string;
  StdErrContent?: string;
  SubmissionScript?: string;
};

export enum Status {
  BOOT_FAIL = "BOOT_FAIL", // BF
  CANCELLED = "CANCELLED", // CA
  CANCELLING = "CANCELLING", // C
  COMPLETED = "COMPLETED", // CD
  CONFIGURING = "CONFIGURING", // CF
  COMPLETING = "COMPLETING", // CG
  DEADLINE = "DEADLINE", // DL
  FAILED = "FAILED", // F
  NODE_FAIL = "NODE_FAIL", // NF
  OUT_OF_ME = "OUT_OF_ME", // OM
  PENDING = "PENDING", // PD
  PREEMPTED = "PREEMPTED", // PR
  RUNNING = "RUNNING", // R
  RESV_DEL_HOLD = "RESV_DEL_HOLD", // RD
  REQUEUE_FED = "REQUEUE_FED", // RF
  REQUEUE_HOLD = "REQUEUE_HOLD", // RH
  REQUEUED = "REQUEUED", // RQ
  RESIZING = "RESIZING", // RS
  REVOKED = "REVOKED", // RV
  SIGNALING = "SIGNALING", // SI
  SPECIAL_EXIT = "SPECIAL_EXIT", // SE
  STAGE_OUT = "STAGE_OUT", // SO
  STOPPED = "STOPPED", // ST
  SUSPENDED = "SUSPENDED", // SS
  TIMEOUT = "TIMEOUT", // TO
  UNKNOWN = "UNKNOWN",
  IDLE = "IDLE",
}

export class JobStatus {
  static RUNNING_STATUSES(): Status[] {
    return [
      Status.RUNNING,
      Status.PENDING,
      Status.CANCELLING,
      Status.CONFIGURING,
      Status.COMPLETING,
      Status.RESIZING,
      Status.SIGNALING,
    ];
  }

  static FAILED_STATUSES(): Status[] {
    return [
      Status.FAILED,
      Status.CANCELLED,
      Status.BOOT_FAIL,
      Status.NODE_FAIL,
      Status.DEADLINE,
      Status.OUT_OF_ME,
      Status.TIMEOUT,
      Status.PREEMPTED,
      Status.REVOKED,
      Status.STOPPED,
      Status.SPECIAL_EXIT,
    ];
  }

  static FINISHED_STATUSES(): Status[] {
    return [Status.COMPLETED, Status.IDLE];
  }
}

export type BlockVarPair = {
  placedID: number;
  blockID: string;
  blockType: BlockTypes;

  variableID: string;
  variableType: PluginVariableTypes;
  variableAllowedValues: Array<string>;
};

/**
 * Represents the status of a flow.
 */
export enum FlowStatus {
  /**
   * The flow is currently running.
   */
  RUNNING = "RUNNING",
  /**
   * The flow is currently paused.
   */
  PAUSED = "PAUSED",
  /**
   * The flow has finished.
   */
  FINISHED = "FINISHED",
  /**
   * The flow has been stopped.
   */
  STOPPED = "STOPPED",
  /**
   * An error occurred in the flow.
   */
  ERROR = "ERROR",
  /**
   * The flow is idle.
   */
  IDLE = "IDLE",
  /**
   * The flow is being cancelled.
   */
  CANCELLING = "CANCELLING",
  /**
   * The flow is queued.
   */
  QUEUED = "QUEUED",

  UNSAVED = "UNSAVED",
}

/**
 * Represents a flow in the application.
 */
export type Flow = {
  /**
   * The ID of the saved flow.
   */
  savedID: string | null;
  /**
   * The path of the flow.
   */
  path: string | null;
  /**
   * The name of the flow.
   */
  name: string;
  /**
   * The status of the flow.
   */
  status: FlowStatus;
  /**
   * The date of the flow.
   */
  date: string;
  /**
   * The blocks in the flow.
   */
  blocks: Array<Block>;
  /**
   * The name of the plugin associated with the flow, in case its a preset
   */
  pluginName?: string;
  pluginID?: string;
  /**
   * The stored terminal output
   */
  terminalOutput: string[];
  /**
   * The Mol* pending tasks
   */
  pendingActions: Array<any>;
  /**
   * The Smiles pending tasks
   */
  pendingSmilesActions: Array<any>;

  /**
   * The Extensions pending tasks
   */
  pendingExtensions: Array<any>;

  /**
   * The flow size
   */
  size?: number;

  /**
   * Timestamp when the flow started executing
   */
  startedTime?: number;

  /**
   * Timestamp when the flow finished executing
   */
  finishedTime?: number;

  /**
   * Total seconds accumulated for all the runs of the flow
   */
  elapsed: number;

  /**
   * True when the user wants to store the flow as a preset
   */
  template?: boolean;

  /**
   * The serialized dock panels
   */
  panels?: SerializedDockview;

  // Extra data
  extraData?: {
    [key: string]: any;
  };
};

export enum DraggableEntity {
  BLOCK = "block",
  CONNECTOR = "connector",
}

export enum DroppableEntity {
  VARIABLE_CONNECTION = "variable_connection",
  CANVAS = "canvas",
  SCALED_CANVAS = "scaled_canvas",
}

export type FlowCanvasObject = {
  flow: Flow;
  handleFlowChange: (flow: Flow) => void;
  handleBlockChange: (block: Block) => void;
  saved: boolean;
};
