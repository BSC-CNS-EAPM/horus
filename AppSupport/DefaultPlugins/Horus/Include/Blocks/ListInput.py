from HorusAPI import PluginVariable, InputBlock, VariableTypes

inputlist = PluginVariable(
    name="Inputs",
    id="input_list",
    description="A list with values to be used as an input.",
    type=VariableTypes.LIST,
)


listBlockInput = InputBlock(
    name="Input list",
    description="A list with values to be used as an input.",
    action=None,
    variable=inputlist,
)