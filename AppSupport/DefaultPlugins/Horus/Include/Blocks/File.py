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

    if not os.path.exists(fileVariableValue):
        raise Exception("Provided path does not exist.")

    if not os.path.isfile(fileVariableValue):
        raise Exception("Provided path is not a file.")

    block.setOutput("file", fileVariableValue)


# Create the block "File"
fileBlock = InputBlock(
    "File", description="Select a single file", action=checkPathIsFile, variable=fileVariable
)
