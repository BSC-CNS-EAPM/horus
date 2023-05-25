from HorusAPI import Plugin, PluginBlock, PluginVariable, VariableTypes
import time

def createYAML(block: PluginBlock):
    print("Creating yaml file...")
    print("Test varialbe: ", block.variables["test"])
    print("System data: ", block.variables["systemData"])
    print("Ligand data: ", block.variables["ligandData"])
    print("Test boolean: ", block.variables["testBoolean"])

    print("Types of the variables:")
    for key in block.variables:
        print(key, ":", type(block.variables[key]))

def waiterFunction(block: PluginBlock):
    print("Waiting...")
    time.sleep(5)
    print("Done waiting")


class NBDSuitePlugin(Plugin):

    systemData = PluginVariable(
        id="systemData",
        name="System data",
        description="The protein system data pdb file.",
        type=VariableTypes.STRING,
        defaultValue="Default protein"
    )

    ligandData = PluginVariable(
        id="ligandData",
        name="Ligand data",
        description="The ligand data pdb file.",
        type=VariableTypes.STRING,
        defaultValue=None
    )

    testVariable = PluginVariable(
        id="test",
        name="Test variable",
        description="A test variable.",
        type=VariableTypes.STRING,
        defaultValue="Test"
    )

    testBoolean = PluginVariable(
        id="testBoolean",
        name="Test boolean",
        description="A test boolean.",
        type=VariableTypes.BOOLEAN,
        defaultValue=False
    )

    createYAMLBlock = PluginBlock(
        name="Create input YAML",
        description="Creates a NBDSuite input file.",
        action=createYAML,
        author="Nostrum Biodiscovery",
        variables=[
            systemData,
            ligandData,
            testVariable,
            testBoolean
            ]
    )

    waiterBlock = PluginBlock(
        name="Waiter",
        description="Waits for 5 seconds.",
        action=waiterFunction,
        author="Nostrum Biodiscovery",
        variables=[],
    )

    info = {
        "name": "NBDSuite",
        "description": "The NBDSuite plugin for Horus",
        "author": "Nostrum Biodiscovery",
        "version": "0.0.1",
        "dependencies": "Peleffy"
    }

plugin = NBDSuitePlugin()