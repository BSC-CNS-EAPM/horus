import typing


class PluginVariable:
    
    id: str = "baseplugin.variable"

    def __init__(
        self,
        name: str,
        description: str,
        type: str,
        defaultValue: typing.Any = None,
    ):
        self.name = name
        self.description = description
        self.type = type
        self.defaultValue = defaultValue
        self.value = defaultValue

        # Initialize a hidden children list
        self.__children = []

    def addChild(self, child):
        if not isinstance(child, PluginVariable):
            raise Exception("The child must be a PluginVariable instance.")
        self.__children.append(child)

    def getChild(self, name):
        for child in self.__children:
            if child.name == name:
                return child
        raise Exception(f"Child {name} not found.")

    def getChildren(self):
        childList = []
        for child in self.__children:
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
    variables: typing.List[PluginVariable] = []

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
        self.variables = variables

    def setAction(self, action: typing.Callable):
        self.action = action

    def addVariable(self, variable: PluginVariable):
        variable.id = f"{self.id}.variable.{self.name}".replace(" ", "_")
        self.variables.append(variable)

    # Define the call method to run the block
    def __call__(self, *args, **kwargs):
        if self.action is None:
            raise Exception("The block has no action defined.")
        return self.action(*args, **kwargs)

    def updateValues(self, values: dict):
        """
        Updates the values of the variables of the block.

        :param values: A dictionary with the values to update 
        (JSON coming from frontend).
        """
        for variable in self.variables:
            if variable.name in values:
                variable.value = values[variable.name]


class Plugin:
    """
    Base class for all plugins.
    """

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

    blocks: typing.List[PluginBlock] = []
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
        for block in self.blocks:
            if block.id == id:
                return block
        raise Exception(f"Block {id} not found.")
