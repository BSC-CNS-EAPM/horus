"""
Get data block
"""

import os
from HorusAPI import PluginVariable, PluginBlock, VariableTypes


# Create a block that adds a given pdb to Mol*
def getData(block: PluginBlock):
    """
    Retrieve data from the remote to the local machine.
    """
    inputPathValue = block.inputs.get("path", None)
    destinationPathValue = block.variables.get("destinationPath", os.getcwd())

    if destinationPathValue == "" or destinationPathValue is None:
        destinationPathValue = os.getcwd()

    if inputPathValue is None:
        raise Exception("No path provided.")

    print(f"Getting data from {inputPathValue} to {destinationPathValue}")

    if not os.path.exists(destinationPathValue):
        os.makedirs(destinationPathValue)

    # Get the data
    block.remote.getData(inputPathValue, destinationPathValue)

    print(f"Data saved at current directory ({destinationPathValue})")


inputPath = PluginVariable(
    name="Path",
    id="path",
    description="The path in the remote to download the data from.",
    type=VariableTypes.STRING,
)

destinationPath = PluginVariable(
    name="Destination path",
    id="destinationPath",
    description="The path to save the data to. (Default to current directory)",
    type=VariableTypes.STRING,
)

getDataBlock = PluginBlock(
    name="Get data",
    description="Transfer data from the remote to the local machine.",
    action=getData,
    inputs=[inputPath],
    variables=[destinationPath],
)
