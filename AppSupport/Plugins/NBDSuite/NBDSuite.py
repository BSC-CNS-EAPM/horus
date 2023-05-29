from HorusAPI import Plugin, PluginBlock, PluginVariable, VariableTypes, PluginPage
import time


def createYAML(block: PluginBlock):
    print("Creating yaml file...")
    print("Test varialbe: ", block.variables["test"])
    print("System data: ", block.variables["systemData"])
    print("Ligand data: ", block.variables["ligandData"])
    print("Test boolean: ", block.variables["testBoolean"])
    print("Test string list: ", block.variables["test_stringlist"])

    print("Types of the variables:")
    for key in block.variables:
        print(key, ":", type(block.variables[key]))


def waiterFunction(block: PluginBlock):
    print("Waiting...")
    time.sleep(5)
    print("Done waiting")


class NBDSuitePlugin(Plugin):
    info = {
        "name": "NBDSuite",
        "description": "The NBDSuite plugin for Horus",
        "author": "Nostrum Biodiscovery",
        "version": "0.0.1",
        "dependencies": "Peleffy",
    }

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

    createYAMLBlock = PluginBlock(
        name="Create input YAML",
        description="Creates a NBDSuite input file.",
        action=createYAML,
        author="Nostrum Biodiscovery",
        variables=[systemData, ligandData, testVariable, testBoolean, test_stringlist],
    )

    waiterBlock = PluginBlock(
        name="Waiter",
        description="Waits for 5 seconds.",
        action=waiterFunction,
        author="Nostrum Biodiscovery",
        variables=[],
    )

    pelePage = PluginPage(
        name="PELE results",
        description="Analyse PELE results.",
        html="pele_results.html",
    )


plugin = NBDSuitePlugin()
