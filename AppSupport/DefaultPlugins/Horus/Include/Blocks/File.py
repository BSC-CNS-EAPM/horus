from HorusAPI import PluginVariable, InputBlock, VariableTypes

fileVariable = PluginVariable(
    name="File",
    id="file",
    description="Select a file",
    type=VariableTypes.FILE,
    allowedValues=["*"],
)

# Create the block "File"
fileBlock = InputBlock(
    "File", description="Select a single file", action=None, variable=fileVariable
)
