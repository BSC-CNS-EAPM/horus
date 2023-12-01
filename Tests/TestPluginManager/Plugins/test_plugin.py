from HorusAPI import Plugin, PluginBlock, PluginVariable, VariableTypes, PluginPage, PluginConfig


plugin = Plugin(id="test_plugin")


def myaction(block):
    print("Running my action...")


myVariable = PluginVariable(
    id="myVariable",
    name="My Variable",
    description="My variable description.",
    type=VariableTypes.STRING,
    defaultValue="DEFAULTVALUE",
)

myBlock = PluginBlock(
    name="My Block",
    description="My block description.",
    action=myaction,
    variables=[myVariable],
)

plugin.addBlock(myBlock)

myPage = PluginPage(
    id="myPage",
    name="My Page",
    description="My page description.",
    html="index.html",
)
plugin.addPage(myPage)

configBlock = PluginConfig(
    name="configblock",
    description="My config block description.",
    variables=[myVariable],
)

plugin.addConfig(configBlock)
