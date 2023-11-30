from HorusAPI import Plugin, VariableTypes, PluginBlock, PluginVariable, Extensions

import time

plugin = Plugin("devplugin")


numberVariable = PluginVariable(
    id="numberVariable",
    name="numberVariable",
    description="This is a number variable",
    type=VariableTypes.NUMBER,
    category="Number variable",
)

numberOutput = PluginVariable(
    id="numberOutput",
    name="numberOutput",
    description="This is a number output",
    type=VariableTypes.NUMBER,
    category="Number output",
)


def sumNumbers(block: PluginBlock):
    value = int(block.inputs["numberVariable"]) + 1

    block.setOutput("numberOutput", value)


testBlock = PluginBlock(
    name="Add 1",
    description="Adds 1 to the input variable",
    inputs=[numberVariable],
    outputs=[numberOutput],
    action=sumNumbers,
)

plugin.addBlock(testBlock)


timeToWaitVar = PluginVariable(
    id="timeToWaitVar",
    name="timeToWaitVar",
    description="Time to wait",
    type=VariableTypes.NUMBER,
)

waiterInput = PluginVariable(
    id="timeToWaitInput",
    name="timeToWaitInput",
    description="Input",
    type=VariableTypes.ANY,
)

waiterOutput = PluginVariable(
    id="timeToWaitOutput",
    name="timeToWaitOutput",
    description="Same as input",
    type=VariableTypes.ANY,
)


def wait(block: PluginBlock):
    sleepTime = int(block.variables.get("timeToWaitVar", 0))

    time.sleep(sleepTime)
    block.setOutput("timeToWaitOutput", block.inputs["timeToWaitInput"])


waiterBlock = PluginBlock(
    name="Wait",
    description="Waits for a given time",
    inputs=[waiterInput],
    variables=[timeToWaitVar],
    outputs=[waiterOutput],
    action=wait,
)

plugin.addBlock(waiterBlock)


def openExtension(block: PluginBlock):
    ext = Extensions()

    ext.open(
        "nbdsuite", "nbdresults", data={"path": "/Users/cdominguez/Downloads/3RLQ/input.yaml"}
    )

    ext.storeExtensionResults(
        "nbdsuite", "nbdresults", data={"path": "/Users/cdominguez/Downloads/3RLQ/input.yaml"}
    )

    ext.storeExtensionResults(
        "nbdsuite",
        "nbdresults",
        data={"path": "/Users/cdominguez/Downloads/3RLQ/input.yaml"},
        title="Results 2",
    )


openExtensionBlock = PluginBlock(
    name="Open extension",
    description="Opens an extension",
    action=openExtension,
    inputs=[waiterInput],
)

plugin.addBlock(openExtensionBlock)


def noInputBlockAction(block: PluginBlock):
    print("this block has no inputs: ", block.inputs)
    print("This block has no input groups: ", block.selectedInputGroup, block._inputGroups)
    print("This block has no variables: ", block.variables)
    print("This block has no outputs: ", block.outputs)


noInputBlock = PluginBlock(
    name="No input block",
    description="This block has no inputs",
    action=noInputBlockAction,
)

plugin.addBlock(noInputBlock)
