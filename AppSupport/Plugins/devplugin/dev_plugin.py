from HorusAPI import Plugin, VariableTypes, PluginBlock, PluginVariable, Extensions, MolstarAPI

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


multipleOutput1 = PluginVariable(
    id="multipleOutput1",
    name="multipleOutput1",
    description="Multiple output 1",
    type=VariableTypes.NUMBER,
)

multipleOutput2 = PluginVariable(
    id="multipleOutput2",
    name="multipleOutput2",
    description="Multiple output 2",
    type=VariableTypes.NUMBER,
)

multipleInput1 = PluginVariable(
    id="multipleInput1",
    name="multipleInput1",
    description="Multiple input 1",
    type=VariableTypes.NUMBER,
)

multipleInput2 = PluginVariable(
    id="multipleInput2",
    name="multipleInput2",
    description="Multiple input 2",
    type=VariableTypes.NUMBER,
)


def multipleInputOutputAction(block: PluginBlock):
    block.setOutput("multipleOutput1", 1)
    block.setOutput("multipleOutput2", 2)


multipleInputOutputBlock = PluginBlock(
    name="Multiple input output",
    description="This block has multiple outputs",
    action=multipleInputOutputAction,
    inputs=[multipleInput1, multipleInput2],
    outputs=[multipleOutput1, multipleOutput2],
)

plugin.addBlock(multipleInputOutputBlock)


def focusResidueAction(block: PluginBlock):
    residue = int(block.inputs["residue"])

    mol = MolstarAPI()
    mol.focusResidue(residue, nearRadius=5)


focusResidueBlock = PluginBlock(
    name="Focus residue",
    description="Focuses on the given residue",
    action=focusResidueAction,
    inputs=[
        PluginVariable(
            id="residue",
            name="Residue",
            description="The residue ID to focus on",
            type=VariableTypes.NUMBER,
        )
    ],
)

plugin.addBlock(focusResidueBlock)


def molviewSpecAciton(block: PluginBlock):
    mol = MolstarAPI()

    # Basic MolstarAPI
    mol.reset()
    mol.addSphere(0, 0, 0, 5, color="#0000ff", opacity=1)
    mol.toggleSpin()
    mol.setBackgroundColor("#ffffff")
    mol.focusResidue(1, nearRadius=5)

    # MolviewSpec
    mvs = mol.mvs
    builder = mvs.create_builder()
    (
        builder.download(url="https://www.ebi.ac.uk/pdbe/entry-files/download/1cbs_updated.cif")
        .parse(format="mmcif")
        .assembly_structure(assembly_id="1")
        .component()
        .representation()
    )

    # finally, we pretty-print everything to the console
    mol.loadMVJS(builder.get_state())


molviewSpecBlock = PluginBlock(
    name="Molview spec",
    description="Loads the molview spec",
    action=molviewSpecAciton,
)

plugin.addBlock(molviewSpecBlock)


def storeBlockVariable(block: PluginBlock):
    runs = block.extraData.get("runs", 0)

    runs += 1

    print(f"Runs: {runs}")

    block.extraData["runs"] = runs


extraDataBlock = PluginBlock(
    name="Extra data test",
    description="Stores extra data",
    action=storeBlockVariable,
)

plugin.addBlock(extraDataBlock)


def flowInsideBlock(block: PluginBlock):
    print(block.flow.savedID)


flowInsideBlockBlock = PluginBlock(
    name="Flow inside block",
    description="Flow inside block",
    action=flowInsideBlock,
)

plugin.addBlock(flowInsideBlockBlock)
