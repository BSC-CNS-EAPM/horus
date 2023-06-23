interface HorusPlugin {
  actions: string;
  author: string;
  blocks: BlockProps[];
  dependencies: string[];
  description: string;
  id: string;
  name: string;
  version: string;
  views: string;
  default: boolean;
}

interface FlowBuilderProps {
  openFlow?: boolean;
}

interface FlowReciverProps {
  openFlow?: boolean;
  flowName: string;
  placedBlocks: BlockProps[];
  setPlacedBlocks: (value: React.SetStateAction<BlockProps[]>) => void;
  savedID?: string;
  flowPath?: string;
  currentSaved: React.MutableRefObject<boolean>;
  setSaved: (saved: boolean) => void;
  placedIDCounter: React.MutableRefObject<number>;
}

export type Coordinates = {
  x: number;
  y: number;
};

interface BlockProps {
  id: string;
  name: string;
  description: string;
  plugin: string;
  variables: PluginVariable<PluginVariableType>[];
  isPlaced: boolean;
  onChange?: () => void;
  execute?: (block: BlockProps) => Promise<void>;
  isRunning?: boolean;
  runError?: boolean;
  placedID: number;
  config: BlockProps[];
  index?: number;
  deleteBlock?: (block: BlockProps) => void;
  subBlocks?: BlockProps[];
  isSubBlock?: boolean;
  placedSubBlocks?: BlockProps[];
  parent?: BlockProps;
  isOnAir?: boolean;
  coords?: Coordinates;
  blockref: React.MutableRefObject<HTMLDivElement>;
  connectedTo?: BlockProps[];
  appearsOn?: BlockProps[];
}

enum PluginVariableTypes {
  STRING = "string",
  INTEGER = "integer",
  FLOAT = "float",
  BOOLEAN = "boolean",
  STRING_LIST = "string[]",
  INTEGER_LIST = "integer[]",
  FLOAT_LIST = "float[]",
  BOOLEAN_LIST = "boolean[]",
  INT_RANGE = "[integer, integer]",
  FLOAT_RANGE = "[float, float]",
  FILE = "file",
  // STRING_ARRAY = "string[]",
  // NUMBER_RANGE = "[number, number]"
}

type PluginVariableType = string | number | boolean; // | string[] | [number, number]; // Define the allowed types

interface PluginVariable<T extends PluginVariableType> {
  name: string;
  id: string;
  description: string;
  type: PluginVariableTypes;
  value: T;
  allowedValues?: T[];
  placedID: number;
}

interface ArrowProps {
  from: BlockProps;
  to: BlockProps;
}

export {
  HorusPlugin,
  FlowReciverProps,
  FlowBuilderProps,
  BlockProps,
  PluginVariableTypes,
  PluginVariableType,
  PluginVariable,
  ArrowProps,
};
