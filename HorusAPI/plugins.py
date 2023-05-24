import typing


class PluginVariable:
    
    id: str = "baseplugin.variable"

    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        type: str,
        defaultValue: typing.Any = None,
    ):
        """
        Create a new PluginVariable.

        :param name: The name of the variable.
        :param description: A description of the variable.
        :param type: The type of the variable.
        :param defaultValue: The default value of the variable.
        :param id: The ID of the variable. 
        Important to identify the variable in Block actions
        """
        self.name = name
        self.description = description
        self.type = type
        self.defaultValue = defaultValue
        self.value = defaultValue
        self.id = id

        # Initialize a hidden children list
        self._children = []

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
        childList = []
        for child in self._children:
            childDict = {
                "name": child.name,
                "description": child.description,
                "type": child.type,
                "defaultValue": child.defaultValue,
                "children": child.getChildren(),
            }
            childList.append(childDict)
        return childList


class PluginBlock:
    id: str = "baseplugin.block"
    """
    The id of the block. It is composed by the author and the name of the block.
    """

    name: str = "Block name"
    """
    The name of the block.
    """

    description: str = "Block description"
    """
    A description of the block.
    """

    action: typing.Optional[typing.Callable] = None
    """
    The action that the block performs.
    """

    # Children of the Block (PluginVariable)
    _variables: typing.List[PluginVariable] = []

    # The output that the block produces
    output = None

    # The input that the block receives
    input = None

    id = "baseplugin.block"

    def __init__(
        self,
        author: str,
        name: str,
        description: str,
        action: typing.Optional[typing.Callable] = None,
        variables: typing.List[PluginVariable] = [],
    ):
        self.name = name
        self.description = description
        self.action = action
        self.author = author
        self._variables = variables

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
            if variable.id in values:
                variable.value = values[variable.id]

    def listVariables(self):
        """
        Returns a list of the variables of the block.
        """
        return self._variables

    @property
    def variables(self):
        varsDict = {}
        for variable in self._variables:
            varsDict[variable.id] = variable.value
        return varsDict


class Plugin:
    """
    Base class for all plugins.
    """

    # Define a init function
    def __init__(self):
        # Set the id of the plugin
        self.id = self.__class__.__name__.lower()

        # Add all the blocks to the list of blocks
        self._addBlocks()

    pythonInterpreter = None
    """
    The python interpreter path used to run the plugin.
    Defaults to the Horus python interpreter.
    If you need to use a different interpreter, when the plugin is run,
    please specify the path to the interpreter.
    """

    info: dict[str, typing.Any] = {
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

    actions: typing.Optional[typing.List[typing.Callable]] = None
    """
    Functions that can be called from the GUI.
    WIP
    """

    views = []
    """
    Views that can be loaded from the GUI.
    Should be the path to the HTML file.
    """

    _blocks: typing.List[PluginBlock] = []
    """
    Blocks that can be used in the GUI flow editor.

    Allowed type: PluginBlock
    """

    # Define comparison operators
    def __eq__(self, other):
        if isinstance(other, Plugin):
            return self.info["name"] == other.info["name"]
        return False

    def __ne__(self, other):
        return not self.__eq__(other)

    # Define the str function fro print(plugin)
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
    
    def _addBlocks(self):
        # Search for all the properties of the instance
        # Check if the property is a PluginBlock
        # If it is, add it to the list of blocks
        for attr in dir(self):
            # Get the attribute
            attr = getattr(self, attr)
            # If the attribute is a PluginBlock, add it to the list
            # Only add the block if it is not already in the list
            if isinstance(attr, PluginBlock):
                attr.id = f"{self.id}.{attr.name}".replace(" ", "_").lower()
                try:
                    self.getBlock(attr.id)
                except Exception:
                    print("Adding block with id: ", attr.id)
                    self._blocks.append(attr)
