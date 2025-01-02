from HorusAPI import PluginVariable, InputBlock, VariableTypes

inputString = PluginVariable(
    name="String",
    id="string",
    description="A string to be used as an input.",
    type=VariableTypes.STRING,
)


stringBlock = InputBlock(
    name="String",
    description="A string to be used as an input.",
    action=None,
    variable=inputString,
    id="string",
    category="Inputs"
)
