interface HorusPlugin {
    actions: string;
    author: string;
    blocks: BlockProps[];
    dependencies: string;
    description: string;
    id: string;
    name: string;
    version: string;
    views: string;
    default: boolean;
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

interface BlockProps {
    id: string;
    name: string;
    description: string;
    plugin: string;
    variables: PluginVariable<PluginVariableType>[];
    isPlaced: boolean;
    onChange?: () => void;
    execute?: (
        block: BlockProps,
    ) => Promise<void>;
    isRunning?: boolean;
    runError?: boolean;
    placedID: number
    config: BlockProps[];
}

// Export the interfaces
export { HorusPlugin, PluginVariable, PluginVariableType, PluginVariableTypes, BlockProps };