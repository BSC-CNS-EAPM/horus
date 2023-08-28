from HorusAPI import PluginVariable, InputBlock, VariableTypes


folderVariable = PluginVariable(
    name="Folder",
    id="folder",
    description="Select a folder",
    type=VariableTypes.FOLDER,
)

# Create the block "Folder"
folderBlock = InputBlock(
    "Folder", description="Select a folder", action=None, variable=folderVariable
)
