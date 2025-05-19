from HorusAPI import InputBlock, PluginVariable, VariableTypes

interactiveChainVariable = PluginVariable(
    name="Interactive Chain",
    id="interactive_chain",
    description="Select a chain",
    type=VariableTypes.CHAIN_INTERACTIVE,
)

# Create the block "Chains"
interactiveChainBlock = InputBlock(
    name=interactiveChainVariable.name,
    description=interactiveChainVariable.description,
    action=None,
    variable=interactiveChainVariable,
    id=interactiveChainVariable.id,
    category="Structures",
)
