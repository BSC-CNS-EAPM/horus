from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginVariable,
    VariableTypes,
    PluginConfig,
)

plugin = Plugin(id="debug")

plugin.info = {
    "name": "Debug",
    "description": "Internal plugin for debugging purposes.",
    "author": "Nostrum Biodiscovery",
    "version": "0.0.1",
    "dependencies": [],
}

variable_1 = PluginVariable(
    id="variable_1",
    name="Variable_1",
    description="Test variable.",
    type=VariableTypes.STRING,
    defaultValue="",
)

def printVariable_1(block: PluginBlock):
    print("Variable value:")
    print(block.variables["variable_1"])

b = PluginBlock(
    name="Print test",
    description="Prints the value of variable 1",
    variables=[variable_1],
    action=printVariable_1,
)

plugin.addBlock(b)

time_variable = PluginVariable(
    id="time_variable",
    name="Sleep seconds",
    description="Time.sleep() variable.",
    type=VariableTypes.INTEGER,
    defaultValue=0,
)

def sleep(block: PluginBlock):
    import time
    print("Sleeping...")
    parseint = int(block.variables["time_variable"])
    time.sleep(parseint)

b_2 = PluginBlock(
    name="Sleep",
    description="Sleeps for a given amount of seconds.",
    variables=[time_variable],
    action=sleep,
)

plugin.addBlock(b_2)

