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

    if block.remote.name != "Local":
        try:
            block.remote.remoteCommand("test -d " + folderVariableValue)
        except Exception:
            print(f"Provided path '{folderVariableValue}' is not a folder on the remote server.")
    elif not os.path.exists(folderVariableValue) and not os.path.isdir(folderVariableValue):
        print(f"Provided '{folderVariableValue}' path is not a folder on the local machine.")

    block.setOutput("folder", folderVariableValue)


# Create the block "Folder"
folderBlock = InputBlock(
    "Folder",
    description="Select a folder",
    action=checkPathIsFolder,
    variable=folderVariable,
    id="folder",
)
