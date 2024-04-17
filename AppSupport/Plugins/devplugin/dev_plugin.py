import time

from HorusAPI import (
    InputBlock,
    SlurmBlock,
    Plugin,
    VariableTypes,
    PluginBlock,
    PluginVariable,
    Extensions,
    MolstarAPI,
    PluginPage,
    CustomVariable,
)


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
    id="add_1",
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

    runs = block.extraData.get("runs", 0)

    if runs == 0:
        print("First run")
    else:
        print(f"Run {runs}")

    runs += 1
    block.extraData["runs"] = runs

    time.sleep(sleepTime)
    block.setOutput("timeToWaitOutput", block.inputs["timeToWaitInput"])


waiterBlock = PluginBlock(
    name="Wait",
    description="Waits for a given time",
    inputs=[waiterInput],
    variables=[timeToWaitVar],
    outputs=[waiterOutput],
    action=wait,
    id="wait",
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
    id="open_extension",
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
    id="no_input_block",
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
    id="multiple_input_output",
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
    id="focus_residue",
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
    id="molview_spec",
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
    id="extra_data_test",
)

plugin.addBlock(extraDataBlock)


def flowInsideBlock(block: PluginBlock):
    print(block.flow.savedID)


flowInsideBlockBlock = PluginBlock(
    name="Flow inside block",
    description="Flow inside block",
    action=flowInsideBlock,
    id="flow_inside_block",
)

plugin.addBlock(flowInsideBlockBlock)


def testSlurmBlockAction(block: SlurmBlock):

    print("Test slurm block action")

    print("is local?", block.remote.isLocal)

    timeToWait = int(block.inputs.get("timeToWait", 0))

    # Submit test job to the current remote
    script = f"""#!/bin/bash
#SBATCH --qos="short"
#SBATCH --partition="short"
#SBATCH --job-name="tunnel"
#SBATCH --time=2:00:00     # walltime
#SBATCH --ntasks=8  # number of cores
#SBATCH --mem-per-cpu=1GB

echo "Hello world"

# Wait
sleep {timeToWait}
    
"""

    with open("test.sh", "w") as f:
        f.write(script)

    # Upload the script to the remote
    finalPath = block.remote.sendData("test.sh", block.remote.workDir)

    jobID = block.remote.submitJob(finalPath)

    print("Job ID: ", jobID)


def finalTestSlurmBlockAction(block: SlurmBlock):
    print("Test slurm block final action")

    block.setOutput("time_to_wait", block.inputs["timeToWait"])


slurmBlockTest = SlurmBlock(
    name="Slurm block test",
    description="Slurm block test",
    initialAction=testSlurmBlockAction,
    finalAction=finalTestSlurmBlockAction,
    inputs=[
        PluginVariable(
            id="timeToWait",
            name="Time to wait",
            description="Time to wait",
            type=VariableTypes.NUMBER,
        )
    ],
    outputs=[
        PluginVariable(
            id="time_to_wait",
            name="Time waited",
            description="The same as input",
            type=VariableTypes.NUMBER,
        )
    ],
    id="slurm_block_test",
)

plugin.addBlock(slurmBlockTest)


def testExtensionsShortcuts(block: PluginBlock):
    text = "Hello this is some text"

    Extensions().loadText(text, title="Some text")

    # Generate a random html
    html = """
    <html>
        <body>
            <h1>Test</h1>
            <p>This is a test</p>
        </body>
    </html>
    """

    Extensions().loadHTML(html, title="Some HTML")

    # Download an image from the internet
    image = "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"

    import requests

    downloadedImage = requests.get(image)

    with open("google.png", "wb") as f:
        f.write(downloadedImage.content)

    Extensions().loadImage("google.png", title="Goolge image")


testExtensionsShortcutsBlock = PluginBlock(
    name="Test extensions shortcuts",
    description="Tests extensions shortcuts",
    action=testExtensionsShortcuts,
    id="test_extensions_shorcuts",
)

plugin.addBlock(testExtensionsShortcutsBlock)

devPage = PluginPage(
    id="dev_page",
    name="Dev page",
    description="Dev page",
    html="dev.html",
    hidden=True,
)

plugin.addPage(devPage)

customRenderPage = PluginPage(
    id="custom_render_page",
    name="Custom render page",
    description="Custom render page",
    html="customrender.html",
    hidden=False,
)

plugin.addPage(customRenderPage)

customVariableTest = CustomVariable(
    id="custom_variable_test",
    name="Custom variable test",
    description="Custom variable test",
    customPage=devPage,
    type=VariableTypes.NUMBER,
    category="Custom variables",
)


def customVariableAction(block: InputBlock):
    print(block.inputs["custom_variable_test"])


testCustomVariableInputBlock = InputBlock(
    name="Test custom variable",
    description="Test custom variable",
    variable=customVariableTest,
    action=customVariableAction,
    id="test_custom_variable",
)

plugin.addBlock(testCustomVariableInputBlock)


def checkPluginPathAction(block: PluginBlock):
    print(block.pluginDir)


pluginPathActionBlock = PluginBlock(
    id="pluginPath", name="Plugin path", description="Plugin path", action=checkPluginPathAction
)

plugin.addBlock(pluginPathActionBlock)
