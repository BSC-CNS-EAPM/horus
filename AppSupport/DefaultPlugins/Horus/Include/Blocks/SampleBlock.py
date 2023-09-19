from HorusAPI import PluginVariable, SlurmBlock, VariableTypes, PluginConfig

# First define the input to be used in the block
inputFile = PluginVariable(
    name="File",
    id="fileID",
    description="A file to upload to a remote server.",
    type=VariableTypes.FILE,
)

# Then define the output to be used in the block
outputFile = PluginVariable(
    name="Output file",
    id="outputFile",
    description="The file downloaded from the remote server after the job is finished.",
    type=VariableTypes.FILE,
)

# You can also define a regular variable, which is independent of the inputs.
# This variable will be available in the block configuration button.
regularVariable = PluginVariable(
    name="Regular variable",
    id="regularVariable",
    description="A regular variable.",
    type=VariableTypes.STRING,
)


# Then define the action that the block will perform before the job is sent to the Slurm queue
def myCustomActionBefore(block: SlurmBlock):
    # The block passed to the function contains an updated dictionary of the variables
    # acces it using the variable id either for the regular variables or the inputs.

    regularVariableValue = block.variables["regularVariable"]
    inputFilePath = block.inputs["fileID"]

    print("Regular variable value: " + regularVariableValue)

    # Upload the file to the remote server using the RemoteAPI
    block.remote.sendData(inputFilePath, "/path/in/remote/server")

    jobID = block.remote.submitJob("/path/in/remote/server")

    print("Job submitted with ID: ", jobID)


# Then define the action that the block will perform after the job is finished
def myCustomActionAfter(block: SlurmBlock):
    print("Job finished, downloading results...")

    # Download the results from the remote server using the RemoteAPI
    block.remote.getData("/path/in/remote/server", "/path/in/local/machine")

    # Set the output variable to the path of the downloaded file
    block.setOutput("outputFile", "/path/in/local/machine")


# Finally, instantiate the block giving it a name, a description, the action to be performed and the variable.
sendJobBlock = SlurmBlock(
    name="Send a job",
    description="Submits a job to the remote and downloads the results",
    initialAction=myCustomActionBefore,
    finalAction=myCustomActionAfter,
    variables=[regularVariable],
    inputs=[inputFile],
    outputs=[outputFile],
)


configVariable = PluginVariable(
    name="Config variable",
    id="configVariable",
    description="A variable that will be available in block.configs",
    type=VariableTypes.STRING,
)


def configAction(block: SlurmBlock):
    print("Config variable value: " + block.configs["configVariable"])


configBlock = PluginConfig(
    name="Config for the send a job block",
    description="A block that will be available in the plugin configuration.",
    action=configAction,
    variables=[configVariable],
)

sendJobBlock.addConfig(configBlock)
