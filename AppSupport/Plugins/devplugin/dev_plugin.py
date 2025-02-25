from re import I
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
    SmilesAPI,
    PluginPage,
    CustomVariable,
    PluginConfig,
    VariableList,
    VariableGroup,
)


plugin = Plugin()


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
    required=True,
    placeholder="Write here the time to wait",
)

waiterInput = PluginVariable(
    id="timeToWaitInput",
    name="timeToWaitInput",
    description="Input",
    type=VariableTypes.ANY,
    required=True,
    placeholder="Write here the time to wait",
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
        "nbdsuite",
        "nbdresults",
        data={"path": "/Users/cdominguez/Downloads/3RLQ/input.yaml"},
    )

    ext.storeExtensionResults(
        "nbdsuite",
        "nbdresults",
        data={"path": "/Users/cdominguez/Downloads/3RLQ/input.yaml"},
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
    mol.setSpin()
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


script_variable = PluginVariable(
    id="script_variable",
    name="Slurm script",
    description="Slurm script",
    type=VariableTypes.CODE,
    allowedValues=["shell"],
    defaultValue="""#!/bin/bash
#SBATCH --qos="short"
#SBATCH --partition="short"
#SBATCH --job-name="tunnel"
#SBATCH --time=2:00:00     # walltime
#SBATCH --ntasks=8  # number of cores
#SBATCH --mem-per-cpu=1GB

echo "Hello world"

""",
)


def testSlurmBlockAction(block: SlurmBlock):

    print("Test slurm block action")

    print("is local?", block.remote.isLocal)

    timeToWait = int(block.inputs.get("timeToWait", 0) or 0)

    # Submit test job to the current remote
    script = block.variables[script_variable.id] + f"\n\nsleep {timeToWait}\n"

    if block.extraData.get("submits") is None:
        block.extraData["submits"] = 0

    n = block.extraData["submits"]
    block.extraData["submits"] += 1

    file = f"test_{n}"
    with open(file, "w") as f:
        f.write(script)

    # Upload the script to the remote
    import os

    finalPath = os.path.join(block.remote.workDir, file)
    try:
        finalPath = block.remote.sendData(file, block.remote.workDir)
    except Exception as e:
        print("Error uploading script: ", e)

    jobID = block.remote.submitJob(finalPath)

    print("Job ID: ", jobID)


def finalTestSlurmBlockAction(block: SlurmBlock):
    print("Test slurm block final action")

    print("Status of slurm job: ", block.status)

    timeToWait = int(block.inputs.get("timeToWait", 0) or 0)

    block.setOutput("time_to_wait", timeToWait)


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
    variables=[script_variable],
    id="slurm_block_test",
    category="Slurm",
)


def multipleSlurmTest(block: SlurmBlock):
    quantity = int(block.variables["quantity"] or 5)

    # Submit test job to the current remote
    script = """#!/bin/bash
#SBATCH --qos="short"
#SBATCH --partition="short"
#SBATCH --job-name="tunnel"
#SBATCH --time=2:00:00     # walltime
#SBATCH --ntasks=8  # number of cores
#SBATCH --mem-per-cpu=1GB
#SBATCH --output="slurm-%j.out"   # STDOUT output file
#SBATCH --error="slurm-%j.err"   # STDERR error file

start_time=$(date +%s)
iterations=0
max_iterations=10

while [ $iterations -lt $max_iterations ]; do
    elapsed=$(( $(date +%s) - start_time ))
    echo "Elapsed time: ${elapsed} seconds"
    sleep 10
    ((iterations++))
done

echo "Script finished after $max_iterations iterations."


"""

    import os

    paths = []
    remote_folder = os.path.join(block.remote.workDir, "tests")
    # Remove the folder
    block.remote.command(f"rm -rf {remote_folder}")
    for n in range(quantity):
        file = f"test_{n}"
        with open(file, "w") as f:
            f.write(script)

        paths.append(file)

    # Upload the folder to the remote
    remote_folder = block.remote.sendData(os.getcwd(), remote_folder)

    paths = [os.path.join(remote_folder, path) for path in paths]

    jobID = block.remote.submitJob(paths)

    print("Submitted jobs: ", "\n".join(jobID))


quantity_variable = PluginVariable(
    id="quantity",
    name="Quantity",
    description="How many jobs to submit",
    type=VariableTypes.NUMBER,
)

multipleSlurmTestBlock = SlurmBlock(
    name="Multiple slurm block test",
    description="Slurm block test",
    initialAction=multipleSlurmTest,
    variables=[quantity_variable],
    inputs=[timeToWaitVar],
    finalAction=lambda block: None,
    category="Slurm",
)

plugin.addBlock(multipleSlurmTestBlock)


def testSlurmBlockFailedAction(block: SlurmBlock):

    print("This block will fail and then continue")

    script = """#!/bin/bash
#SBATCH --qos="short"
#SBATCH --partition="short"
#SBATCH --job-name="tunnel"
#SBATCH --time=2:00:00     # walltime
#SBATCH --ntasks=8  # number of cores
#SBATCH --mem-per-cpu=1GB

echo "Hello world"

# Wait
sleep 200

# fail
exit 1
    
"""

    with open("test.sh", "w") as f:
        f.write(script)

    # Upload the script to the remote
    import os

    finalPath = os.path.join(block.remote.workDir, "test.sh")
    try:
        finalPath = block.remote.sendData("test.sh", block.remote.workDir)
    except Exception as e:
        print("Error uploading script: ", e)

    jobID = block.remote.submitJob(finalPath)

    print("Job ID: ", jobID)


slurmBlockFailes = SlurmBlock(
    name="Slurm block test fail",
    description="Slurm block test fail and continue",
    initialAction=testSlurmBlockFailedAction,
    finalAction=finalTestSlurmBlockAction,
    id="slurm_block_test_fail",
    failOnSlurmError=False,
    category="Slurm",
)

plugin.addBlock(slurmBlockTest)
plugin.addBlock(slurmBlockFailes)

extension_input_variable = PluginVariable(
    id="extensions_input", name="Input", description="Input", type=VariableTypes.STRING
)

extension_output_variable = PluginVariable(
    id="extensions_output",
    name="output",
    description="output",
    type=VariableTypes.STRING,
)


def testExtensionsShortcuts(block: PluginBlock):

    print("Test extensions shortcuts. Toggle: ", block.variables.get("toggle", False))

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

    block.setOutput(extension_output_variable.id, block.inputs[extension_input_variable.id])

    csv = """col1,col2,col3\n"""
    for i in range(10):
        csv += f"{i},{i*2},{i*3}\n"
    with open("file.csv", "w") as f:
        f.write(csv)

    Extensions().loadCSV("file.csv", title="Some CSV")


def finalAction(block: PluginBlock):
    print("Final action")

    import requests

    # Download an image from the internet
    image = "https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png"

    downloadedImage = requests.get(image)

    with open("google.png", "wb") as f:
        f.write(downloadedImage.content)

    Extensions().loadImage("google.png", title="Goolge image")


some_toggle_variable = PluginVariable(
    id="toggle",
    name="Toggle",
    description="Toggle",
    type=VariableTypes.BOOLEAN,
)

testExtensionsShortcutsBlock = SlurmBlock(
    name="Test extensions shortcuts",
    description="Tests extensions shortcuts",
    initialAction=testExtensionsShortcuts,
    finalAction=finalAction,
    id="test_extensions_shorcuts",
    inputs=[extension_input_variable],
    variables=[some_toggle_variable],
    outputs=[extension_output_variable],
    category="Slurm",
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
    id="pluginPath",
    name="Plugin path",
    description="Plugin path",
    action=checkPluginPathAction,
)

plugin.addBlock(pluginPathActionBlock)


# Configs

config_catego_1 = PluginVariable(
    id="config_1",
    name="Config 1",
    description="Configuration number 1",
    type=VariableTypes.STRING,
    category="Special",
)

config_catego_2 = PluginVariable(
    id="config_2",
    name="Config 2",
    description="Configuration number 2",
    type=VariableTypes.STRING,
    category="Necessary",
)

test_config = PluginConfig(
    id="test_config",
    name="Test config",
    description="Description configuration",
    variables=[config_catego_1, config_catego_2],
)

plugin.addConfig(test_config)


def test_config_action(block: PluginBlock):
    print("Selected remote: ", block.selectedRemote)
    print("Block config:", block.config)


test_config_block = PluginBlock(
    id="Test_config_block",
    name="Test config block",
    description="Test config block",
    action=test_config_action,
)

plugin.addBlock(test_config_block)


def add_smiles_action(block: PluginBlock):

    SmilesAPI().reset()

    smiles = "CCCO a label"
    SmilesAPI().addSmiles(smiles)

    smiles = "CNC=OC"
    SmilesAPI().addSmiles(smiles)

    csv_contents = """smi,label,energy
CCCO,a label,-0.5
CNC=OC,other label,1.0
"""

    with open("smiles.csv", "w") as f:
        f.write(csv_contents)

    SmilesAPI().addCSV("smiles.csv")

    SmilesAPI().addSmilesWithData(
        [
            {
                "smi": "CN(CCCCO)CCNO",
                "label": "superSmiles",
                "group": "group 1",
                "properties": {"energy": 0.5},
            }
        ]
    )


add_smiles_block = PluginBlock(
    id="add_smiles_block",
    name="Add smiles",
    description="Add smiles",
    action=add_smiles_action,
)

plugin.addBlock(add_smiles_block)


integer_input = PluginVariable(
    id="integer_input",
    name="Integer input",
    description="Integer input",
    type=VariableTypes.NUMBER,
)

string_input = PluginVariable(
    id="string_input",
    name="String input",
    description="String input",
    type=VariableTypes.STRING,
)

atom_input = PluginVariable(
    id="atom_input",
    name="Atom input",
    description="Atom input",
    type=VariableTypes.ATOM,
)

dropdown_input = PluginVariable(
    id="dropdown_input",
    name="Dropdown input",
    description="Dropdown input",
    type=VariableTypes.STRING_LIST,
    allowedValues=["Value 1", "Value 2", "Value 3"],
)

boolean_input = PluginVariable(
    id="boolean_input",
    name="Boolean input",
    description="Boolean input",
    type=VariableTypes.BOOLEAN,
)

variable_list_multiple = VariableList(
    id="variable_group_multiple",
    name="Variable group multiple",
    description="Variable group multiple",
    prototypes=[integer_input, string_input, atom_input, dropdown_input, boolean_input],
)

input_block_variable_list = InputBlock(
    id="input_block_variable_list",
    name="Input block variable list",
    description="Input block variable list",
    variable=variable_list_multiple,
    action=None,
    category="input",
)

plugin.addBlock(input_block_variable_list)

input_block_string_list = InputBlock(
    id="input_block_string_list",
    name="Input block string list",
    description="Input block string list",
    variable=PluginVariable(
        id="string_list_input",
        name="String list input",
        description="String list input",
        type=VariableTypes.LIST,
        allowedValues=[VariableTypes.STRING],
    ),
    action=None,
    category="input",
)

plugin.addBlock(input_block_string_list)

input_block_variablegroup = InputBlock(
    id="input_block_variablegroup",
    name="Input block variable group",
    description="Input block variable group",
    variable=VariableGroup(
        id="variable_group",
        name="Variable group",
        description="Variable group",
        variables=[
            integer_input,
            string_input,
            atom_input,
            dropdown_input,
            boolean_input,
            variable_list_multiple,
        ],
    ),
    action=None,
)

plugin.addBlock(input_block_variablegroup)

number_input = PluginVariable(
    id="number_input",
    name="Number input",
    description="Number input",
    type=VariableTypes.NUMBER_RANGE,
    allowedValues=[0, 100, 1],
)


input_block_number = InputBlock(
    id="input_block_number",
    name="Input block number",
    description="Input block number",
    variable=number_input,
    action=None,
)

plugin.addBlock(input_block_number)


radio_input = PluginVariable(
    id="radio_input",
    name="Radio input",
    description="Radio input",
    type=VariableTypes.RADIO,
    allowedValues=["Value 1", "Value 2", "Value 3"],
)


input_block_radio = InputBlock(
    id="input_block_radio",
    name="Input block radio",
    description="Input block radio",
    variable=radio_input,
    action=None,
)

plugin.addBlock(input_block_radio)

checkbox_input = PluginVariable(
    id="checkbox_input",
    name="Checkbox input",
    description="Checkbox input",
    type=VariableTypes.CHECKBOX,
    allowedValues=["Value 1", "Value 2", "Value 3"],
)


input_block_checkbox = InputBlock(
    id="input_block_checkbox",
    name="Input block checkbox",
    description="Input block checkbox",
    variable=checkbox_input,
    action=None,
)

plugin.addBlock(input_block_checkbox)


def fail_on_even_action(block: PluginBlock):

    block.extraData["runs"] = block.extraData.get("runs", 0) + 1
    print("Runs: ", block.extraData["runs"])

    if block.extraData["runs"] % 2 == 0:
        raise Exception("Failed on even runs")

    print("Passed on odd runs")

    block.setOutput("input_output_even", block.inputs["input_output_even"])


input_output_even = PluginVariable(
    id="input_output_even",
    name="Input output even",
    description="Input output even",
    type=VariableTypes.ANY,
)

fail_on_even_block = PluginBlock(
    id="fail_on_even_block",
    name="Fail on even",
    description="Fail on even",
    action=fail_on_even_action,
    inputs=[input_output_even],
    outputs=[input_output_even],
    category="Other blocks",
)

plugin.addBlock(fail_on_even_block)


def print_lots_of_logs(block: PluginBlock):

    for i in range(0, 100):
        print("Printing a lot of logs, this is iteration: " + str(i))


print_lots_of_logs_block = PluginBlock(
    id="print_lots_of_logs_block",
    name="Print lots of logs",
    description="Print lots of logs",
    action=print_lots_of_logs,
)

plugin.addBlock(print_lots_of_logs_block)


def dirty_block(block: PluginBlock):
    print("Is this block dirty?", block.dirty)

    block.setOutput("input_output_even", block.inputs["input_output_even"])


dirty_block_block = PluginBlock(
    id="dirty_block_block",
    name="Dirty block",
    description="Dirty block",
    action=dirty_block,
    inputs=[input_output_even],
    outputs=[input_output_even],
    category="Other blocks",
)

plugin.addBlock(dirty_block_block)


number_variable_list = PluginVariable(
    id="number_variable_list",
    name="Number variable list",
    description="Number variable list",
    type=VariableTypes.LIST,
    allowedValues=[VariableTypes.NUMBER],
)

strings_variable_list = PluginVariable(
    id="strings_variable_list",
    name="String variable list",
    description="Number variable list",
    type=VariableTypes.LIST,
)


files_variable_list = PluginVariable(
    id="file_variable_list",
    name="Files variable list",
    description="Number variable list",
    type=VariableTypes.LIST,
    allowedValues=[VariableTypes.FILE],
)

range_variable_list = PluginVariable(
    id="range_variable_list",
    name="Range variable list",
    description="Number variable list",
    type=VariableTypes.LIST,
    allowedValues=[VariableTypes.CONSTRAINED_NUMBER_RANGE],
)

atom_variable_list = PluginVariable(
    id="atom_variable_list",
    name="Atom variable list",
    description="Number variable list",
    type=VariableTypes.LIST,
    allowedValues=[VariableTypes.ATOM],
)

structures_variable_list = PluginVariable(
    id="structures_variable_list",
    name="Structures variable list",
    description="Number variable list",
    type=VariableTypes.LIST,
    allowedValues=[VariableTypes.STRUCTURE],
)

multiple_allowed_list = PluginVariable(
    id="multiple_variable_list",
    name="Multiple variable list",
    description="Number variable list",
    type=VariableTypes.LIST,
    allowedValues=[VariableTypes.ATOM, VariableTypes.STRUCTURE],
)

# unallowed_variable_list = PluginVariable(
#     id="number_variable_list",
#     name="Number variable list",
#     description="Number variable list",
#     type=VariableTypes.LIST,
#     allowedValues=[VariableTypes.LIST],
# )

multiple_list_block = PluginBlock(
    id="multiple_list_block",
    name="Multiple list block",
    description="Multiple list block",
    action=None,
    variables=[
        number_variable_list,
        strings_variable_list,
        files_variable_list,
        range_variable_list,
        atom_variable_list,
        structures_variable_list,
        multiple_allowed_list,
        # unallowed_variable_list,
    ],
    category="Other blocks",
)

plugin.addBlock(multiple_list_block)

outputvar = PluginVariable(
    id="outvar", name="outvar", description="Set output variable", type=VariableTypes.STRING
)


def first_action(block: SlurmBlock):
    """ """

    block.setOutput(outputvar.id, "test_value")


def final_action(block: SlurmBlock):
    print(block._storedOutputs)
    print(block.outputs)
    print(block._outputs)


test_setoutput_first_action = SlurmBlock(
    id="test_setoutput",
    name="Test setOutput",
    description="Test the setOutput function",
    initialAction=first_action,
    finalAction=final_action,
    outputs=[outputvar],
)

plugin.addBlock(test_setoutput_first_action)
