import logging
from HorusAPI import PluginBlock, PluginVariable, VariableTypes
from Server.PluginManager import SubprocessManager


inputVariable = PluginVariable(
    name="Input",
    id="input",
    description="Variables to be used in the code. Can be accessed with the 'inputs' variable. For example: print(inputs)",
    type=VariableTypes.ANY,
)

codeVariable = PluginVariable(
    name="Code",
    id="code",
    description="Write a Python script",
    type=VariableTypes.CODE,
    allowedValues=["python"],
    defaultValue="""# The inputs of the block are in the 'inputs' variable
print("inputs are", inputs)

# The output of the block can be set
# with the setOutput function
setOutput("hello world!")""",
)


HORUS_INTERNAL_ENVIRONMENT = "horus (internal)"


class EnvironmentVariable(PluginVariable):
    """
    Extracts the allowed values from the loaded plugins
    """

    envs_stored = False

    def toDict(self, minimal: bool = False):

        if self.envs_stored:
            return super().toDict(minimal)

        varDict = super().toDict(minimal)

        # Replace the allowedValues with the existing plugins
        from App import AppDelegate

        try:
            # Get the conda runtime path
            condaRuntime = AppDelegate().server.settingsManager.getSetting("condaRuntime").value

            if condaRuntime is None or condaRuntime == "":
                raise Exception("Conda runtime path is not set in the settings")

            # Get the conda environments
            p = SubprocessManager.callPopen(
                [condaRuntime, "env", "list"], wait=False, comunicate=True
            )

            p.wait()

            # List the environments
            if p.returncode == 0 and p.stdout:
                envs = p.stdout.read().strip().split("\n")

                # Skip the two first lines (column headers)
                envs = envs[2:]

                # Parse the environment names
                envs = [env.strip() for env in envs if env.strip() and not env.startswith("#")]
                envs = [env.split()[0] for env in envs if env.strip()]

                varDict["allowedValues"] = [HORUS_INTERNAL_ENVIRONMENT] + envs
                self.envs_stored = True

        except Exception as e:
            logging.getLogger("Horus").error("Error getting conda environments: %s", e)
            self.envs_stored = True  # Avoids trying to get the environments again

        return varDict


environmentVariable = EnvironmentVariable(
    name="Conda environment",
    id="environment",
    description="Select a Conda environment to run the code.",
    type=VariableTypes.STRING_LIST,
    defaultValue="horus (internal)",
    allowedValues=[HORUS_INTERNAL_ENVIRONMENT],  # This will be filled with the existing plugins
)

outputVariable = PluginVariable(
    name="Output",
    id="output",
    description="The output of the code. Can be setted with the 'setOutput' function. For example: setOutput(my_value)",
    type=VariableTypes.ANY,
)


def executePython(block: PluginBlock):
    """
    Converts a string into a Python script and runs it
    """

    # Get the code
    pythonCode = block.variables[codeVariable.id]

    # Generate a easy variable to access the inputs
    inputs = block.inputs[inputVariable.id]

    # Generate a easy variable to access the outputs
    def setOutput(value):
        block.setOutput(outputVariable.id, value)

    # Get the environment variable
    environment = block.variables[environmentVariable.id]
    if environment == HORUS_INTERNAL_ENVIRONMENT:
        exec(pythonCode)
    else:
        # Call conda
        from App import AppDelegate

        condaRuntime = AppDelegate().server.settingsManager.getSetting("condaRuntime").value
        if condaRuntime is None or condaRuntime == "":
            raise Exception("Conda runtime path is not set in the settings")

        # Create a temporary file to store the code
        import tempfile

        with tempfile.NamedTemporaryFile(delete=False, suffix=".py") as tempFile:

            # Insert the inputs and setOutput function at the beginning of the code
            pythonCode = f"""
inputs = {inputs}
def setOutput(value):

    print("Setoutput function called with value:", value)
    
    # Store the output in a temporal json file
    import json
    import os
    outputFile = os.path.join(os.path.dirname(__file__), "output.json")
    with open(outputFile, "w") as f:
        json.dump(value, f)
{pythonCode}
            """

            tempFile.write(pythonCode.encode("utf-8"))
            tempFilePath = tempFile.name

        # Call the conda environment with the code
        try:
            SubprocessManager.callPopen(
                [condaRuntime, "run", "-n", environment, "python", tempFilePath],
            )

            # Read the output from the temporary file
            import json
            import os

            outputFile = os.path.join(os.path.dirname(tempFilePath), "output.json")

            if os.path.exists(outputFile):
                with open(outputFile, "r") as f:
                    output = json.load(f)
                block.setOutput(outputVariable.id, output)
            else:
                block.setOutput(outputVariable.id, None)

        except Exception as e:
            raise RuntimeError(f"Error executing Python code in environment '{environment}': {e}")


# Create the block "Code"
pythonCodeBlock = PluginBlock(
    codeVariable.name,
    description=codeVariable.description,
    action=executePython,
    inputs=[inputVariable],
    variables=[environmentVariable, codeVariable],
    outputs=[outputVariable],
    id=codeVariable.id,
    category="Code",
)
