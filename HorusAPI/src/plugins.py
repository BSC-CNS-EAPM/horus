from __future__ import annotations
import typing
import json
import os


class TempFile:
    """Temporary file class used to store temporary files in user dirs"""

    def __init__(self, name: str, folder: typing.Optional[str] = None):
        """
        - Name: The name of the file.
        - Folder: The folder where the file will be stored.
        If None, the file will bestored in the tmp folder.
        """
        if folder is None:
            folder = self._tmpDir()

        # Check if the user has as tmp folder, if not create it
        if not os.path.exists(folder):
            self._create_tmp_folder(folder)

        # Randomize the file name in order to prevent file clashes
        self.name = str(os.urandom(10).hex()) + name

        # Define the path of the tmp folder
        self.tmpFolder = folder

        # Define the path of the file
        self.path = os.path.join(self.tmpFolder, self.name)

        # Create the file
        self._create()

    def _tmpDir(self):
        # Assign the path of the tmp folder
        # to the current python working directory
        tmpName = "tmp"
        return os.path.join(os.getcwd(), tmpName)

    def __repr__(self):
        return self.name

    def __str__(self):
        return self.path

    def __eq__(self, other):
        return self.path == other.path

    def __hash__(self):
        return hash(self.name + self.path)

    def __del__(self):
        # Delete the file
        self.delete()

        # If the tmp folder is empty, delete it
        if len(os.listdir(self.tmpFolder)) == 0:
            self.deleteTmpFolder()

    def _create_tmp_folder(self, folder: str):
        # Create a temporary folder
        tmp_folder = os.path.join(folder)
        os.mkdir(tmp_folder)

    def _create(self):
        # Create the file with the content of the string
        with open(self.path, "w") as f:
            f.write("")

    def delete(self):
        """
        Delete the file.
        """
        os.remove(self.path)

    def write(self, content: str):
        """
        Write content to the file

        - content: The content to write to the file.
        """
        with open(self.path, "w") as f:
            f.write(content)

    def read(self):
        """
        Read the content of the file

        :return: The content of the file as a string.
        """
        with open(self.path, "r") as f:
            return f.read()

    def deleteTmpFolder(self):
        """
        Deletes the tmp folder.
        """
        # Delete the tmp folder
        import shutil

        shutil.rmtree(self.tmpFolder)


class PluginEndpoint:
    def __init__(self, url: str, methods: typing.List[str], function: typing.Callable):
        """
        Create a new PluginEndpoint.

        :param url: The URL of the endpoint.
        :param method: The method of the endpoint.
        :param function: The function that will be called when the endpoint is accessed.
        To the function the request object will be passed as the first argument.
        Remember to define the function with the request argument.
        """
        self.url = url
        self.methods = methods
        self.function = function


class PluginPage:
    endpoints: typing.List[PluginEndpoint] = []
    """
    Define endpoints that the plugin can access from the defined pages.
    The endpoint URL should be defined as a string, for example: "/my_endpoint".
    Later, Horus will add the endpoint in the following format: 
    "/plugins/pages/pluginid.pagename/my_endpoint".
    Therefore, remember to perform any GET or POST request to that endpoint.

    Note: pluginid and pagename are always lowercase.
    """

    _pageInfo: typing.Dict[str, typing.Any] = {}
    """
    Internal variable used to store the page info.
    """

    def __init__(self, name: str, description: str, html: str):
        """
        Create a new PluginPage.

        :param name: The name of the page.
        :param description: A description of the page.
        :param html: The name of the HTML file (i.e. "my_page.html").
        The html file must be located in the "Pages" folder of the plugin.
        """
        self.id: str = "baseplugin.page"
        self.name = name
        self.description = description
        self.html = html

    def addEndpoint(self, endpoint: PluginEndpoint):
        """
        Add an endpoint to the page.

        :param endpoint: The endpoint to add.
        """
        self.endpoints.append(endpoint)


class VariableTypes:
    STRING = "string"
    """
    A regular string like "Hello world".

    Will render as a text input.
    """

    INTEGER = "integer"
    """
    A regular integer like 1, 2, 3...

    Will render as a text input.
    """

    FLOAT = "float"
    """
    A regular float like 1.0, 2.0, 3.0...

    Will render as a text input.
    """

    BOOLEAN = "boolean"
    """
    A boolean value: True or False.

    Will render as a checkbox.
    """

    STRING_LIST = "string[]"
    """
    A list of strings like ["Hello", "World"].

    Will render as a dropdown.
    """

    INTEGER_LIST = "integer[]"
    """
    A list of integers like [1, 2, 3].

    Will render as a dropdown.
    """

    FLOAT_LIST = "float[]"
    """
    A list of floats like [1.0, 2.0, 3.0].

    Will render as a dropdown.
    """

    BOOLEAN_LIST = "boolean[]"
    """
    A list of booleans like [True, False].

    Will render as a radio items buttons.
    """

    INT_RANGE = "[integer, integer]"
    """
    A range of integers like 1-10.

    Will render as a slider.
    """

    FLOAT_RANGE = "[float, float]"
    """
    A range of floats like 1.0-10.0.

    Will render as a slider.
    """

    FILE = "file"
    """
    A file.

    - On the server: Will open the server file explorer.
    - On the desktop: Will render as a system file picker.
    """

    FOLDER = "folder"
    """
    A folder.

    - On the server: Will open the server file explorer.
    - On the desktop: Will render as a system folder picker.
    """

    STRUCTURE = "structure"
    """
    A molecular structure to be selected from Mol*.

    Will render as a dropdown with the list of loaded structures.
    The type of the variable will be a dictionary with the following keys:
    - id: The ID of the structure.
    - name: The name of the structure.
    - type: The type of the structure (CIF, PDB...).
    - structure: The structure object (CIF, PDB... string)
    """

    @staticmethod
    def getTypes():
        """
        Returns a list of all the available types.
        """
        types = []
        for attr_name in dir(VariableTypes):
            attr = getattr(VariableTypes, attr_name)
            if not callable(attr) and not attr_name.startswith("__"):
                types.append(attr)

        return types


class PluginVariable:
    id: str = "baseplugin.variable"

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        type: str,
        defaultValue: typing.Optional[typing.Any] = None,
        allowedValues: typing.Optional[typing.List[typing.Any]] = None,
    ):
        """
        Create a new PluginVariable.

        :param name: The name of the variable.
        :param description: A description of the variable.
        :param type: The type of the variable. Assign it using the VariableTypes class.
        :param defaultValue: The default value of the variable.
        :param id: The ID of the variable.
        :param allowedValues: A list of allowed values for the variable
        if it is a list, range or files.
        Important to identify the variable in Block actions
        """
        self.name = name
        self.description = description
        self.type = type

        if type not in VariableTypes.getTypes():
            raise Exception(f"Invalid type {type}.")

        self.defaultValue = defaultValue
        self.value = defaultValue
        self.id = id
        self.allowedValues = allowedValues

    def toDict(self):
        """
        Convert the variable to a dictionary.
        """

        varDict = {
            "name": self.name,
            "id": self.id,
            "description": self.description,
            "type": self.type,
            "value": ""
            if self.defaultValue is None
            else self.defaultValue
            if not self.value
            else self.value,
            "allowedValues": self.allowedValues,
        }

        return varDict


class PluginBlock:
    def __init__(
        self,
        name: str,
        description: str,
        action: typing.Optional[typing.Callable] = None,
        variables: typing.List[PluginVariable] = [],
        inputs: typing.List[PluginVariable] = [],
        outputs: typing.List[PluginVariable] = [],
    ):
        self.id: str = "baseplugin.block"
        """
        The id of the block. 
        It is composed by the plugin name and the name of the block.
        The addBlock() method of the Plugin class will automatically
        assign the id to the block.
        """

        self.name = name
        """
        The name of the block.
        """

        self.description = description
        """
        A description of the block.
        """

        self.action = action
        """
        The action that the block performs.
        """

        self._variables = variables
        """
        Variables that can be used in the Block action
        """

        self._outputs = outputs
        """
        The output that the block produces as a list of PluginVariables.
        This information will be displayed in the flow builder.
        The produced output can be used in the following blocks as input.
        """

        self._inputs = inputs
        """
        The input that the block receives as a list of PluginVariables.
        This information will be displayed in the flow builder.
        The input can be used in the block action.
        """

        self._configs: typing.List[PluginConfig] = []
        """
        Configs that can be used to configure the block.

        Allowed type: PluginConfig
        """

    # Define the call method to run the block
    def __call__(self, *args, **kwargs):
        if self.action is None:
            print("WARNING: No action defined for block", self.name)
        else:
            # Run the action
            self.action(self, *args, **kwargs)

        # Get the updated output as dictionary
        return self.outputs

    def _updateVariables(self, values: dict):
        """
        Updates the values of the variables of the block.

        :param values: A dictionary with the values to update
        (JSON coming from frontend).
        """
        for variable in self._variables:
            if variable.id in values.keys():
                variable.value = values[variable.id]

    def _updateInputs(self, values: dict):
        """
        Updates the values of the inputs of the block.

        :param values: A dictionary with the values to update
        (JSON coming from frontend).
        """
        for variable in self._inputs:
            if variable.id in values.keys():
                variable.value = values[variable.id]

    def _getVariables(self):
        """
        Returns a list of the variables of the block.
        """
        return self._variables

    @property
    def variables(self):
        varsDict: dict[str, typing.Any] = {}
        for variable in self._variables:
            varsDict[variable.id] = variable.value
        return varsDict

    @property
    def inputs(self):
        varsDict: dict[str, typing.Any] = {}
        for variable in self._inputs:
            varsDict[variable.id] = variable.value
        return varsDict

    @property
    def outputs(self):
        varsDict: dict[str, typing.Any] = {}
        for variable in self._outputs:
            varsDict[variable.id] = variable.value
        return varsDict

    def setOutput(self, id: str, value: typing.Any):
        """
        Sets the value of an output variable.

        :param id: The id of the output variable.
        :param value: The value to set.
        """
        for variable in self._outputs:
            if variable.id == id:
                variable.value = value
                return
        raise Exception(f"Output {id} not found.")

    def _getConfig(self, id: str):
        """
        Returns a config by its ID.

        :param id: The ID of the config.
        """
        for config in self._configs:
            if config.id == id:
                return config
        raise Exception(f"Config {id} not found.")

    def _getConfigs(self):
        return self._configs

    @property
    def configs(self):
        configsDict: dict[str, typing.Any] = {}
        for config in self._configs:
            for var in config._getVariables():
                configsDict[var.id] = var.value
        return configsDict

    def addConfig(self, config: PluginConfig):
        """
        Adds a PluginConfig to the plugin.
        """

        # If the attribute is a PluginConfig, add it to the list
        # Only add the config if it is not already in the list
        if isinstance(config, PluginConfig):
            config.id = f"{self.id}.{config.name}".replace(" ", "_").lower()
            try:
                self._getConfig(config.id)
            except Exception:
                self._configs.append(config)

    def _updateConfigs(self, configPath: str):
        """
        Updates the values of the configs of the block.
        From the config JSON file.
        """

        # Read the config file
        with open(configPath, "r") as configFile:
            configs = json.load(configFile)

        # Update the values of the configs
        for config in self._configs:
            for var in config._getVariables():
                if var.id in configs.keys():
                    var.value = configs[var.id]

    def _createConfig(self, configPath: str):
        """
        Creates the config file for the block.
        """
        # Create the config file only if the block has configs

        if len(self._configs) > 0:
            # Create the config file
            print("Creating config file for block", self.name, "at", configPath)
            with open(configPath, "w") as configFile:
                configs = {}
                for config in self._configs:
                    configs[config.id] = config.variables
                json.dump(self.configs, configFile, indent=4)

    def _saveConfig(self, configPath: str, valuesToSave: dict[str, str]):
        """
        Saves the config file for the block with new values.
        """
        # Save the config file only if the block has configs
        if len(self._configs) > 0:
            # Read the existing config file
            with open(configPath, "r") as configFile:
                configs = json.load(configFile)

            # Update the values to save
            for key, value in valuesToSave.items():
                configs[key] = value

            # Write the updated config file
            with open(configPath, "w") as configFile:
                json.dump(configs, configFile, indent=4)

        # Update the values of the configs
        self._updateConfigs(configPath)

    def _toDict(self):
        """
        Converts the block to a dictionary.
        """

        blockDict = {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "variables": self._variablesToDict(self._variables),
            "inputs": self._variablesToDict(self._inputs),
            "outputs": self._variablesToDict(self._outputs),
            "config": self._configToDict(),
        }

        return blockDict

    def _variablesToDict(self, vars: typing.List[PluginVariable]):
        varList: list[dict[str, typing.Any]] = []
        for v in vars:
            varList.append(v.toDict())
        return varList

    def _configToDict(self):
        configList: list[dict[str, typing.Any]] = []
        for c in self._getConfigs():
            configList.append(c._toDict())
        return configList


class PluginConfig(PluginBlock):
    """
    The PluginConfig class is a special type of block that is used to configure
    the plugin. It is not meant to be used in the pipeline. It works as a regular
    PluginBlock but it is shown only in the configuration page of the plugin.
    Its variables will be stored once set, and can be accessed by the Block actions
    using the block.config["variable_id"] syntax.
    """

    def __init__(
        self,
        name,
        description,
        action: typing.Optional[typing.Callable] = None,
        variables: typing.List[PluginVariable] = [],
    ):
        # Raise an error if the variables are empty
        if len(variables) == 0:
            raise Exception("A PluginConfig must have at least one variable.")

        super().__init__(name, description, action, variables)


class Plugin:
    """
    Base class for all plugins.
    """

    def __init__(self, id: str):
        """
        Initializes the plugin.

        :param id: The id of the plugin.
        """

        self.pythonInterpreter = None
        """
        The python interpreter path used to run the plugin.
        Defaults to the Horus python interpreter.
        If you need to use a different interpreter, when the plugin is run,
        please specify the path to the interpreter.

        WIP
        """

        self.info: dict[str, typing.Any] = {
            "name": "Plugin",
            "version": "0.0.1",
            "author": "None",
            "description": "None",
            "dependencies": ["None"],
        }
        """
        Information about the plugin.

        :param name: The name of the plugin
        :param version: The version of the plugin
        :param author: The author of the plugin
        :param description: A description of the plugin
        :param dependencies: A list of dependencies of the plugin
        """

        self._filename: str = ""
        """
        The filename of the plugin. Internal use only.
        """

        self._path: str = ""
        """
        The path of the plugin folder. Internal use only.
        """

        self.actions: typing.Optional[typing.List[typing.Callable]] = None
        """
        Functions that can be called from the GUI.
        WIP
        """

        self.views = []
        """
        Views that can be loaded from the GUI.
        Should be the path to the HTML file.
        """

        self._blocks: typing.List[PluginBlock] = []
        """
        Blocks that can be used in the GUI flow editor.

        Allowed type: PluginBlock
        """

        self._pages: typing.List[PluginPage] = []
        """
        Pages that can be loaded from the GUI.

        Allowed type: PluginPage
        """

        # Set the id of the plugin
        self.id = id.lower().replace(" ", "_")

        # Add all the blocks present in the subclass to the list of blocks
        self._addBlocks()

        # Same for pages
        self._addPages()

    # Define comparison operators
    def __eq__(self, other):
        if isinstance(other, Plugin):
            return self.info["name"] == other.info["name"]
        return False

    def __ne__(self, other):
        return not self.__eq__(other)

    # Define the str function to print(plugin)
    def __str__(self):
        return self.info["name"]

    # Function to get a block by its ID
    def getBlock(self, id):
        """
        Returns a block by its ID.

        :param id: The ID of the block.
        """
        for block in self._blocks:
            if block.id == id:
                return block
        raise Exception(f"Block {id} not found.")

    def getBlocks(self):
        return self._blocks

    # Define the .blocks property to the getBlocks function
    @property
    def blocks(self):
        return self.getBlocks()

    def addBlock(self, block: PluginBlock):
        """
        Adds a PluginBlock to the plugin.
        """

        # If the attribute is a PluginBlock (not PluginConfig), add it to the list
        # Only add the block if it is not already in the list
        if isinstance(block, PluginBlock) and not isinstance(block, PluginConfig):
            block.id = f"{self.id}.{block.name}".replace(" ", "_").lower()
            try:
                self.getBlock(block.id)
            except Exception:
                # Assign to the configs in the block the ID
                for config in block._getConfigs():
                    config.id = f"{block.id}.config.{config.name}".replace(
                        " ", "_"
                    ).lower()
                self._blocks.append(block)

    def _addBlocks(self):
        # Search for all the properties of the instance
        # Check if the property is a PluginBlock
        # If it is, add it to the list of blocks
        for attr in dir(self):
            # Get the attribute
            attr = getattr(self, attr)

            # Add the block to the list of blocks
            self.addBlock(attr)

    def getPage(self, id):
        """
        Returns a page by its ID.

        :param id: The ID of the page.
        """
        for page in self._pages:
            if page.id == id:
                return page
        raise Exception(f"Page {id} not found.")

    def getPages(self):
        return self._pages

    @property
    def pages(self):
        return self.getPages()

    def addPage(self, page: PluginPage):
        """
        Adds a PluginPage to the plugin.
        """

        # If the attribute is a PluginPage, add it to the list
        # Only add the page if it is not already in the list
        if isinstance(page, PluginPage):
            page.id = f"{self.id}.{page.name}".replace(" ", "_").lower()
            try:
                self.getPage(page.id)
            except Exception:
                self._pages.append(page)

    def _addPages(self):
        # Search for all the properties of the instance
        # Check if the property is a PluginPage
        # If it is, add it to the list of pages
        for attr in dir(self):
            # Get the attribute
            attr = getattr(self, attr)

            # Add the page to the list of pages
            self.addPage(attr)
