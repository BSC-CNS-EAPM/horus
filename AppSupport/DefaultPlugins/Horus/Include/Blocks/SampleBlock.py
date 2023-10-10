from HorusAPI import PluginBlock, VariableTypes, PluginVariable


inputVariable = PluginVariable(
    name="input",
    description="The input to the block.",
    type=VariableTypes.STRING,
    id="input",
)

inputVariable2 = PluginVariable(
    name="input2",
    description="The second input to the block.",
    type=VariableTypes.STRING,
    id="input2",
)

output1variable = PluginVariable(
    name="output1",
    description="The first output of the block.",
    type=VariableTypes.STRING,
    id="output1",
)

output2variable = PluginVariable(
    name="output2",
    description="The second output of the block.",
    type=VariableTypes.STRING,
    id="output2",
)


def action(block: PluginBlock):
    inputVal = block.inputs.get("input", None)
    inputVal2 = block.inputs.get("input2", None)
    if inputVal is None:
        raise Exception("No input provided.")
    block.setOutput("output1", inputVal)
    block.setOutput("output2", inputVal2)


sampleBlock = PluginBlock(
    name="Sample Block",
    description="A sample block.",
    inputs=[inputVariable, inputVariable2],
    outputs=[output1variable, output2variable],
    action=action,
)
