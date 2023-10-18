import os
from HorusAPI import PluginVariable, InputBlock, VariableTypes

folderVariable = PluginVariable(
    name="Folder",
    id="folder",
    description="Select a folder",
    type=VariableTypes.FOLDER,
)


def checkPathIsFolder(block: InputBlock):
    folderVariableValue = block.inputs.get("folder", None)

    if folderVariableValue is None:
        raise Exception("No folder provided.")

    if not os.path.exists(folderVariableValue):
        raise Exception("Provided path does not exist.")

    if not os.path.isdir(folderVariableValue):
        raise Exception("Provided path is not a folder.")

    block.setOutput("folder", folderVariableValue)


# Create the block "Folder"
folderBlock = InputBlock(
    "Folder", description="Select a folder", action=checkPathIsFolder, variable=folderVariable
)
