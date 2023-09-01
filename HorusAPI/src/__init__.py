# Export the HorusAPI plugins
from HorusAPI.src.plugins import (
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
)

# Export the Molstar API
from HorusAPI.src.molstar import MolstarAPI

# Export the utility SingletonMeta class
from HorusAPI.src.utils import SingletonMeta as HorusSingleton
from HorusAPI.src.utils import TempFile

# Set the exported modules
__all__ = [
    "Plugin",
    "PluginBlock",
    "InputBlock",
    "SlurmBlock",
    "PluginVariable",
    "VariableTypes",
    "VariableGroup",
    "PluginPage",
    "PluginConfig",
    "PluginEndpoint",
    "MolstarAPI",
    "HorusSingleton",
    "TempFile",
]

# Set the module name
__module__ = "HorusAPI"
