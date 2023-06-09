interface FlowBuilderProps {
  openFlow?: boolean;
}

interface FlowReciverProps {
  openFlow?: boolean;
  flowName: string;
  placedBlocks: BlockProps[];
  setPlacedBlocks: (blocks: BlockProps[]) => void;
  savedID?: string;
  flowPath?: string;
}

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
}

export {
  FlowReciverProps,
  FlowBuilderProps,
  BlockProps,
  PluginVariableTypes,
  PluginVariableType,
  PluginVariable,
};
