# Export the HorusAPI plugins
from .plugins import (
    Plugin,
    PluginBlock,
    InputBlock,
    SlurmBlock,
    PluginVariable,
    VariableTypes,
    VariableGroup,
    PluginPage,
    PluginConfig,
    PluginEndpoint,
    VariableList,
)

# Export the Molstar API
from .molstar import MolstarAPI

# Export the extensions API
from .extensions import Extensions

# Export the utility SingletonMeta class
from .utils import SingletonMeta as HorusSingleton
from .utils import TempFile, ResetRemoteException

# Set the exported modules
__all__ = [
    "Plugin",
    "PluginBlock",
    "InputBlock",
    "SlurmBlock",
    "PluginVariable",
    "VariableTypes",
    "VariableGroup",
    "VariableList",
    "PluginPage",
    "PluginConfig",
    "PluginEndpoint",
    "MolstarAPI",
    "Extensions",
    "HorusSingleton",
    "TempFile",
    "ResetRemoteException",
]

# Set the module name
__module__ = "HorusAPI"
