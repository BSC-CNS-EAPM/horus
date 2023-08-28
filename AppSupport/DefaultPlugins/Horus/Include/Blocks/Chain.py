from HorusAPI import InputBlock, PluginVariable, VariableTypes

chainsVariable = PluginVariable(
    name="Chains",
    id="chains",
    description="Select individual chains",
    type=VariableTypes.CHAIN,
)

# Create the block "Chains"
chainBlock = InputBlock(
    "Chains",
    description="Select individual chains",
    action=None,
    variable=chainsVariable,
)
