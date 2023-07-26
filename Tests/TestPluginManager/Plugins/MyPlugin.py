from HorusAPI import Plugin, PluginBlock, PluginVariable, VariableTypes, PluginPage


plugin = Plugin(id="myplugin")

plugin.info = {
    "name": "My Plugin",
    "description": "My plugin description.",
    "author": "me",
    "version": "0.0.1",
}


def myaction(block):
    print("Running my action...")


myVariable = PluginVariable(
    id="myVariable",
    name="My Variable",
    description="My variable description.",
    type=VariableTypes.STRING,
    defaultValue="",
)

myBlock = PluginBlock(
    name="My Block",
    description="My block description.",
    action=myaction,
    variables=[myVariable],
)

plugin.addBlock(myBlock)

myPage = PluginPage(
    name="My Page",
    description="My page description.",
    html="index.html",
)

plugin.addPage(myPage)
