import os
from HorusAPI import PluginVariable, InputBlock, VariableTypes
from Server.RemotesManager import RemotesManager

fileVariable = PluginVariable(
    name="File",
    id="file",
    description="Select a file",
    type=VariableTypes.FILE,
    allowedValues=["*"],
)


def checkPathIsFile(block: InputBlock):
    fileVariableValue = block.inputs.get("file", None)

    if fileVariableValue is None:
        raise Exception("No file provided.")

    if block.remote.name != RemotesManager.LOCAL_REMOTE_NAME:
        try:
            block.remote.command("test -f " + fileVariableValue)
        except Exception:
            print(f"Provided path '{fileVariableValue}' is not a file on the remote server.")
    elif not os.path.exists(fileVariableValue) and not os.path.isfile(fileVariableValue):
        print(f"Provided path '{fileVariableValue}' is not a file on the local machine.")

    block.setOutput("file", fileVariableValue)


# Create the block "File"
fileBlock = InputBlock(
    "File",
    description="Select a single file",
    action=checkPathIsFile,
    variable=fileVariable,
    id="file",
    category="Files",
)
