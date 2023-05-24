from HorusAPI import Plugin, PluginBlock, PluginVariable

class NBDSuitePlugin(Plugin):

    def createYAML(self):
        print("Creating yaml file...")
        print("System data: ", self.systemData.value)
        print("Ligand data: ", self.ligandData.value)

    systemData = PluginVariable(
        name="System data",
        description="The protein system data pdb file.",
        type="string",
        defaultValue=None
    )

    ligandData = PluginVariable(
        name="Ligand data",
        description="The ligand data pdb file.",
        type="string",
        defaultValue=None
    )

    createYAMLBlock = PluginBlock(
        name="Create input YAML",
        description="Creates a NBDSuite input file.",
        action=createYAML,
        author="Nostrum Biodiscovery",
        variables=[
            systemData,
            ligandData
            ]
    )

    blocks = [createYAMLBlock]

    info = {
        "name": "NBDSuite",
        "description": "The NBDSuite plugin for Horus",
        "author": "Nostrum Biodiscovery",
        "version": "0.0.1",
        "dependencies": "Peleffy"
    }

plugin = NBDSuitePlugin()