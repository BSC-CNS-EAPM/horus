from HorusAPI import InputBlock, PluginVariable, VariableTypes

atomsVariable = PluginVariable(
    name="Atoms",
    id="atoms",
    description="Select individual atoms",
    type=VariableTypes.ATOM,
)

# Create the block "Hetero atom"
atomBlock = InputBlock(
    "Atoms",
    description="Select individual atoms",
    action=None,
    variable=atomsVariable,
    id="atoms",
)
