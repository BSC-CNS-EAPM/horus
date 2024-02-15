from HorusAPI import PluginVariable, InputBlock, VariableTypes

inputArea = PluginVariable(
    name="Text Area",
    id="textArea",
    description="A Text area to be used as an input.",
    type=VariableTypes.TEXT_AREA,
)


textAreaBlock = InputBlock(
    name="Text Area",
    description="A Text area to be used as an input.",
    action=None,
    variable=inputArea,
)
