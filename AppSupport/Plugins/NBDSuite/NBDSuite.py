from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
    PluginPage,
    PluginConfig,
)

plugin = Plugin(id="NBDSuite")

plugin.info = {
    "name": "NBDSuite",
    "description": "The NBDSuite plugin for Horus",
    "author": "Nostrum Biodiscovery",
    "version": "0.0.1",
    "dependencies": "Peleffy",
}

# Define the variables for the Input Yaml block
systemData = PluginVariable(
    id="systemData",
    name="System data",
    description="The protein system data pdb file.",
    type=VariableTypes.FILE,
    defaultValue="Default protein",
)

ligandData = PluginVariable(
    id="ligandData",
    name="Ligand data",
    description="The ligand data pdb file.",
    type=VariableTypes.STRING,
    defaultValue=None,
)

testVariable = PluginVariable(
    id="test",
    name="Test variable",
    description="A test variable.",
    type=VariableTypes.STRING,
    defaultValue="Test",
)

testBoolean = PluginVariable(
    id="testBoolean",
    name="Test boolean",
    description="A test boolean.",
    type=VariableTypes.BOOLEAN,
    defaultValue=False,
)

test_stringlist = PluginVariable(
    id="test_stringlist",
    name="Test string list",
    description="A test string list.",
    type=VariableTypes.STRING_LIST,
    defaultValue="Test3",
    allowedValues=["Test1", "Test2", "Test3"],
)

test_radio = PluginVariable(
    id="test_radio",
    name="Test radio",
    description="A test radio.",
    type=VariableTypes.BOOLEAN_LIST,
    defaultValue=False,
    allowedValues=[True, False],
)


# Define the action for the Input Yaml block
def createYAML(block: PluginBlock):
    print("Creating yaml file...")
    print("Test varialbe: ", block.variables["test"])
    print("System data: ", block.variables["systemData"])
    print("Ligand data: ", block.variables["ligandData"])
    print("Test boolean: ", block.variables["testBoolean"])
    print("Test string list: ", block.variables["test_stringlist"])
    print("Config list: ", block.configs)

    print("Types of the variables:")
    for key in block.variables:
        print(key, ":", type(block.variables[key]))


# Define the Input Yaml block
createYAMLBlock = PluginBlock(
    name="NBDSuite input",
    description="Creates a NBDSuite input file.",
    action=createYAML,
    variables=[systemData, ligandData, testVariable, testBoolean, test_stringlist],
)


# Create a Topology Fixer block
topologyFixerBlock = PluginBlock(
    name="Topology Fixer",
    description="Fixes the topology of a protein-ligand complex.",
    action=lambda block: print("Adding topology fixer block..."),
    variables=[
        PluginVariable(
            id="enable-topology-fixer",
            name="Enable topology fixer",
            description="Enable topology fixer.",
            type=VariableTypes.BOOLEAN,
            defaultValue=True,
        )
    ],
)

# Create an Adaptive PELE block
peleBlock = PluginBlock(
    name="Adaptive PELE",
    description="Add PELE simulation to your NBDSuite simulation.",
    action=lambda block: print("Saving pele block into yaml..."),
    variables=[
        PluginVariable(
            id="pele-epochs",
            name="Epochs",
            description="PELE simulation epochs.",
            type=VariableTypes.INTEGER,
            defaultValue=1,
        ),
    ],
)


def runSimulation(block: PluginBlock):
    print("Running simulation?...")
    try:
        license = block.configs["license"]
        print("License: ", license)
        if license is None or license == "":
            raise Exception
    except Exception:
        print("No license found.")


runSimulationBlock = PluginBlock(
    name="Run simulation",
    description="Runs the simulation.",
    action=runSimulation,
    variables=[],
)


def validateLicense(config: PluginConfig):
    print("Validating pele license...", config.variables)


# Create a pele license config
peleLicense = PluginConfig(
    name="PELE License",
    description="PELE license configuration.",
    action=validateLicense,
    variables=[
        PluginVariable(
            id="license",
            name="License",
            description="PELE license path.",
            type=VariableTypes.FILE,
            defaultValue=None,
        )
    ],
)


# Add the peleLicense to the runSimulationBlock
runSimulationBlock.addConfig(peleLicense)


# Add the blocks as a sublock of the createYAMLBlock
createYAMLBlock.addSubBlock(peleBlock)
createYAMLBlock.addSubBlock(runSimulationBlock)
createYAMLBlock.addSubBlock(topologyFixerBlock)

# Add the Input Yaml block to the plugin
plugin.addBlock(createYAMLBlock)


def sendNBDCalc(block: PluginBlock):
    print("Sending to NBDCalc cluster...")
    print("Host: ", block.configs["host"])
    print("User: ", block.configs["user"])


sendToCluster = PluginBlock(
    name="Send to NBDCalc",
    description="Submits the calculation to the NBDCalc cluster.",
    action=sendNBDCalc,
    variables=[],
)

sendToClusterConfig = PluginConfig(
    name="NBDCalc cluster",
    description="NBDCalc cluster configuration.",
    action=None,
    variables=[
        PluginVariable(
            id="host",
            name="Host",
            description="NBDCalc cluster host.",
            type=VariableTypes.STRING,
            defaultValue=None,
        ),
        PluginVariable(
            id="user",
            name="User",
            description="NBDCalc cluster user.",
            type=VariableTypes.STRING,
            defaultValue=None,
        ),
        PluginVariable(
            id="password",
            name="Password",
            description="NBDCalc cluster password.",
            type=VariableTypes.STRING,
            defaultValue=None,
        ),
    ],
)

sendToCluster.addConfig(sendToClusterConfig)

# Add the waiter block to the plugin
plugin.addBlock(sendToCluster)

# Define the PELE results page
pelePage = PluginPage(
    name="PELE results",
    description="Analyse PELE results.",
    html="pele_results.html",
)

# Add the PELE results page to the plugin
plugin.addPage(pelePage)


# Create a new block to write a sample file
def writeFile(block: PluginBlock):
    import os

    print(f"Writing file {block.variables['file']}...")
    print("into folder: ", os.getcwd())
    with open(block.variables["file"], "w") as f:
        f.write("Hello world!")


writeFileBlock = PluginBlock(
    name="Write file",
    description="Writes a sample file.",
    action=writeFile,
    variables=[
        PluginVariable(
            id="file",
            name="File name",
            description="File name to write.",
            type=VariableTypes.STRING,
            defaultValue=None,
        )
    ],
)

# Add the block to the plugin
plugin.addBlock(writeFileBlock)
