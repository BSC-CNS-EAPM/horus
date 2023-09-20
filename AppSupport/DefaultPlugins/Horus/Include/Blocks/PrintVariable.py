from HorusAPI import PluginVariable, PluginBlock, VariableTypes

inputVariable = PluginVariable(
    name="Input",
    id="input",
    description="The variable to print.",
    type=VariableTypes.ANY,
)

outputVariable = PluginVariable(
    name="Output",
    id="output",
    description="The variable to print.",
    type=VariableTypes.ANY,
)


# Create a block that prints a given variable
def printVariable(block: PluginBlock):
    inputVariable = block.inputs.get("input", None)

    if inputVariable is None:
        raise Exception("No input provided.")

    print(f"Recieved input: {inputVariable}")

    block.setOutput("output", inputVariable)


printBlock = PluginBlock(
    name="Print variable",
    description="Prints a given variable.",
    action=printVariable,
    inputs=[inputVariable],
    outputs=[outputVariable],
)
