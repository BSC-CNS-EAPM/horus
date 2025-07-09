# Export the HorusAPI plugins
from .plugins import (
    Plugin,
    PluginBlock,
    InputBlock,
    SlurmBlock,
    GhostBlock,
    BlockNotFoundError,
    PluginVariable,
    CustomVariable,
    VariableTypes,
    VariableGroup,
    PluginPage,
    PluginConfig,
    PluginEndpoint,
    VariableList,
    PluginMetaModel,
    PlatformType,
    SlurmJob,
    Status,
)

# Export the Molstar API
from .molstar import (
    MolstarAPI,
    MolstarThemeOptions,
    ColorTheme,
    SizeTheme,
    MolRepresentations,
    MolecularSelection,
    SelectionLanguage,
)
from .smiles import SmilesAPI

# Export the extensions API
from .extensions import Extensions

# Export the utility SingletonMeta class
from .utils import SingletonMeta as HorusSingleton
from .utils import (
    TempFile,
    ResetRemoteException,
    getUserFolder,
    initPlugin,
    structureToFile,
    multipleStructuresToFolder,
)

# Set the exported modules
__all__ = [
    "Plugin",
    "PluginBlock",
    "InputBlock",
    "SlurmBlock",
    "GhostBlock",
    "BlockNotFoundError",
    "PluginVariable",
    "CustomVariable",
    "VariableTypes",
    "VariableGroup",
    "VariableList",
    "PluginPage",
    "PluginConfig",
    "PluginEndpoint",
    "MolstarAPI",
    "SmilesAPI",
    "Extensions",
    "HorusSingleton",
    "TempFile",
    "ResetRemoteException",
    "PluginMetaModel",
    "PlatformType",
    "getUserFolder",
    "initPlugin",
    "SlurmJob",
    "Status",
    "MolstarThemeOptions",
    "ColorTheme",
    "SizeTheme",
    "MolRepresentations",
    "MolecularSelection",
    "SelectionLanguage",
    "structureToFile",
    "multipleStructuresToFolder",
]

# Set the module name
__module__ = "HorusAPI"
