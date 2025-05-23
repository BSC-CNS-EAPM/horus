from HorusAPI import InputBlock, PluginVariable, VariableTypes

residuesVariable = PluginVariable(
    name="Residue range",
    id="residue_Range",
    description="Select a residue range",
    type=VariableTypes.RESIDUE_RANGE,
)

# Create the block "Chains"
residueRangeBlock = InputBlock(
    name=residuesVariable.name,
    description=residuesVariable.description,
    action=None,
    variable=residuesVariable,
    id=residuesVariable.id,
    category="Structures",
)
