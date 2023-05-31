from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
    PluginPage,
    PluginConfig,
)
import time

plugin = Plugin(id="NBDSuite")

plugin.info = {
    "name": "NBDSuite",
    "description": "The NBDSuite plugin for Horus",
    "author": "Nostrum Biodiscovery",
    "version": "0.0.1",
    "dependencies": "Peleffy",
}


def waiterFunction(block: PluginBlock):
    print("Waiting...")
    time.sleep(5)
    print("Done waiting")


waiterBlock = PluginBlock(
    name="Waiter",
    description="Waits for 5 seconds.",
    action=waiterFunction,
    variables=[],
)

# Add the waiter block to the plugin
plugin.addBlock(waiterBlock)

# Define the variables for the Input Yaml block
systemData = PluginVariable(
    id="systemData",
    name="System data",
    description="The protein system data pdb file.",
    type=VariableTypes.STRING,
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
    print("License: ", block.configs["license"])

    print("Types of the variables:")
    for key in block.variables:
        print(key, ":", type(block.variables[key]))


# Define the Input Yaml block
createYAMLBlock = PluginBlock(
    name="Create input YAML",
    description="Creates a NBDSuite input file.",
    action=createYAML,
    variables=[systemData, ligandData, testVariable, testBoolean, test_stringlist],
)

# Create a pele license config
peleLicense = PluginConfig(
    name="PELE License",
    description="PELE license configuration.",
    action=lambda block: print("License path: ", block.variables["license"]),
    variables=[
        PluginVariable(
            id="license",
            name="License",
            description="PELE license path.",
            type=VariableTypes.FILE,
            defaultValue="",
        )
    ],
)

# Add a config to the Input Yaml block
createYAMLBlock.addConfig(peleLicense)

# Add the Input Yaml block to the plugin
plugin.addBlock(createYAMLBlock)

# Create a PELE block
peleBlock = PluginBlock(
    name="PELE",
    description="Run PELE.",
    action=lambda block: print("Running PELE..."),
    variables=[],
)

# Create a PELE config
peleConfig = PluginConfig(
    name="PELE",
    description="PELE configuration.",
    action=lambda block: print("PELE config: ", block.variables["peleConfig"]),
    variables=[
        PluginVariable(
            id="peleConfig",
            name="PELE config",
            description="PELE config path.",
            type=VariableTypes.FILE,
            defaultValue="",
        )
    ],
)

# Add a config to the PELE block
peleBlock.addConfig(peleConfig)

# Add the PELE block to the plugin
plugin.addBlock(peleBlock)

# Define the PELE results page
pelePage = PluginPage(
    name="PELE results",
    description="Analyse PELE results.",
    html="pele_results.html",
)

# Add the PELE results page to the plugin
plugin.addPage(pelePage)
