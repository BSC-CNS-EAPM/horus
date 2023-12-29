import os
from HorusAPI import PluginVariable, InputBlock, VariableTypes

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

    if block.remote.name != "Local":
        try:
            block.remote.remoteCommand("test -f " + fileVariableValue)
        except Exception:
            raise Exception("Provided path is not a file on the remote server.") from None
    elif not os.path.exists(fileVariableValue) and not os.path.isfile(fileVariableValue):
        raise Exception("Provided path is not a file on the local machine.")

    block.setOutput("file", fileVariableValue)


# Create the block "File"
fileBlock = InputBlock(
    "File", description="Select a single file", action=checkPathIsFile, variable=fileVariable
)
