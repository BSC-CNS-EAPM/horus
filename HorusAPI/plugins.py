from __future__ import annotations
import typing
import json


class PluginPage:
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

    Will render as a file input.
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

        # Initialize a hidden children list
        self._children: typing.List[PluginVariable] = []

    def addChild(self, child):
        if not isinstance(child, PluginVariable):
            raise Exception("The child must be a PluginVariable instance.")
        self._children.append(child)

    def getChild(self, name):
        for child in self._children:
            if child.name == name:
                return child
        raise Exception(f"Child {name} not found.")

    def getChildren(self):
        childList: list[dict[str, typing.Any]] = []
        for child in self._children:
            childDict = {
                "name": child.name,
                "description": child.description,
                "type": child.type,
                "defaultValue": child.defaultValue,
                "value": child.value,
                "id": child.id,
                "allowedValues": child.allowedValues,
                "children": child.getChildren(),
            }
            childList.append(childDict)
        return childList


class PluginBlock:
    def __init__(
        self,
        name: str,
        description: str,
        action: typing.Optional[typing.Callable] = None,
        variables: typing.List[PluginVariable] = [],
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

        self._configs: typing.List[PluginConfig] = []
        """
        Configs that can be used to configure the block.

        Allowed type: PluginConfig
        """

        # The output that the block produces WIP / maybe not needed
        self.output = None

        # The input that the block receives WIP / maybe not needed
        self.input = None

    def setAction(self, action: typing.Callable):
        self.action = action

    # Define the call method to run the block
    def __call__(self, *args, **kwargs):
        if self.action is None:
            raise Exception("The block has no action defined.")
        return self.action(self, *args, **kwargs)

    def updateValues(self, values: dict):
        """
        Updates the values of the variables of the block.

        :param values: A dictionary with the values to update
        (JSON coming from frontend).
        """
        for variable in self._variables:
            if variable.id in values.keys():
                variable.value = values[variable.id]

    def getVariables(self):
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

    def getConfig(self, id):
        """
        Returns a config by its ID.

        :param id: The ID of the config.
        """
        for config in self._configs:
            if config.id == id:
                return config
        raise Exception(f"Config {id} not found.")

    def getConfigs(self):
        return self._configs

    @property
    def configs(self):
        configsDict: dict[str, typing.Any] = {}
        for config in self._configs:
            for var in config.getVariables():
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
                self.getConfig(config.id)
            except Exception:
                self._configs.append(config)

    def updateConfigs(self, configPath: str):
        """
        Updates the values of the configs of the block.
        From the config JSON file.
        """

        # Read the config file
        with open(configPath, "r") as configFile:
            configs = json.load(configFile)

        # Update the values of the configs
        for config in self._configs:
            for var in config.getVariables():
                if var.id in configs.keys():
                    var.value = configs[var.id]

    def createConfig(self, configPath: str):
        """
        Creates the config file for the block.
        """
        # Create the config file only if the block has configs

        if len(self._configs) > 0:
            # Create the config file
            with open(configPath, "w") as configFile:
                configs = {}
                for config in self._configs:
                    configs[config.id] = config.variables
                json.dump(self.configs, configFile, indent=4)


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
            "dependencies": "None",
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
