type HorusPlugin = {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  dependencies: Array<string>;
  blocks: Array<Block>;
  config: Array<Block>;
  default: boolean;
};

enum PluginVariableTypes {
  ANY = "any",
  STRING = "string",
  NUMBER = "number",
  INTEGER = "integer",
  FLOAT = "float",
  BOOLEAN = "boolean",
  STRING_LIST = "string[]",
  NUMBER_LIST = "number[]",
  NUMBER_RANGE = "[number, number, number]",
  FILE = "file",
  FOLDER = "folder",
  STRUCTURE = "structure",
  HETERORES = "heterores",
  STDRES = "stdres",
  ATOM = "atom",
  CHAIN = "chain",
  SPHERE = "sphere",
  SMILES = "smiles",
  GROUP = "group",
  LIST = "list",
  _LIST = "_list",
}

type PluginVariable = {
  name: string;
  id: string;
  description: string;
  type: PluginVariableTypes;
  value: any;
  placedID: number;
  allowedValues: Array<any>;
  defaultValue: any;

  // For GroupVariable
  variables?: Array<PluginVariable>;
};

enum BlockTypes {
  BASE = "base",
  INPUT = "input",
  ACTION = "action",
  SLURM = "slurm",
  CONFIG = "config",
}

type VariableGroup = {
  id: string;
  name: string;
  description: string;
  variables: Array<PluginVariable>;
};

type Block = {
  // Basic info about the block
  id: string;
  name: string;
  description: string;
  plugin: HorusPlugin;
  type: BlockTypes;

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
  runError: boolean;
  runErrorMessage: string;
  position: { x: number; y: number };
  placedID: number;
  isConnecting: boolean;
  tryingToConnect: PluginVariable | null;
  finishedExecution: boolean;

  // Server execution
  storedOutputs: {
    [key: string]: any;
  };

  // Variable connections
  variableConnections: Array<{
    origin: BlockVarPair;
    destination: BlockVarPair;
    isCyclic: boolean;
    cycles: number;
  }>;

  // Variable connections reference
  // The block connected should know to what is connected
  // in order for arrow deletion to work
  variableConnectionsReference: Array<{
    origin: BlockVarPair;
    destination: BlockVarPair;
  }>;

  // Blocks that should run after this block,
  // without passing any variable
  // The number in the array is the placedID of the block
  connectedTo: Array<number>;

  // Blocks connected referencing this block
  // in order to delete the connection
  // The number in the array is the placedID of the block
  connectedToReference: Array<number>;

  // Block functions
  execute: (block: Block) => Promise<void>;
  onChange: (blockPlacedID: number) => void;
  deleteBlock: (block: Block) => void;
  checkRemoteStatus: (block: Block) => Promise<void>;

  // Slurm blocks
  waitingForJob: boolean;
  status: string;

  // Remote connection
  selectedRemote: string;
  setRemoteConnection: (remote: string) => void;
};

type BlockVarPair = {
  placedID: number;
  blockID: string;
  blockType: BlockTypes;

  variableID: string;
  variableType: PluginVariableTypes;
  variableAllowedValues: Array<string>;
};

enum FlowStatus {
  RUNNING = "RUNNING",
  PAUSED = "PAUSED",
  FINISHED = "FINISHED",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
  IDLE = "IDLE",
}

export {
  HorusPlugin,
  PluginVariable,
  PluginVariableTypes,
  BlockTypes,
  Block,
  BlockVarPair,
  FlowStatus,
};
