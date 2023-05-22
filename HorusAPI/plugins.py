class PluginVariable:
    # The value of the variable
    value = None

    def __init__(self, name, description, type, defaultValue=None):
        self.name = name
        self.description = description
        self.type = type
        self.defaultValue = defaultValue

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
        chilList = []
        for child in self.__children:
            childDict = {
                "name": child.name,
                "description": child.description,
                "type": child.type,
                "defaultValue": child.defaultValue,
                "children": child.getChildren(),
            }
            chilList.append(childDict)


class PluginBlock:
    id: str = None
    """
    The id of the block. It is composed by the author and the name of the block.
    """

    name: str = None
    """
    The name of the block.
    """

    description: str = None
    """
    A description of the block.
    """

    action: callable = None
    """
    The action that the block performs.
    """

    # Children of the Block (PluginVariable)
    variables: list[PluginVariable] = []

    # The output that the block produces
    output = None

    # The input that the block receives
    input = None

    def __init__(
        self, author: str, name: str, description: str, action: callable = None
    ):
        self.id = f"{author}.{name}"
        self.name = name
        self.description = description
        self.action = action
        self.author = author


class PluginAction:
    def __init__(self, inputs, outputs, action):
        self.action = action
        self.inputs = inputs
        self.outputs = outputs

    def __call__(self, *args, **kwargs):
        try:
            self.action()
            return True
        except Exception as e:
            print(f"Error running plugin action: {e}")
            return False


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

    info = {
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

    actions: list[PluginAction] = []
    """
    Functions that can be called from the GUI.
    """

    views = []
    """
    Views that can be loaded from the GUI.
    Should be the path to the HTML file.
    """

    blocks: list[PluginBlock] = []
    """
    Blocks that can be used in the GUI flow editor.

    Allowed type: PluginBlock
    """

    # Define comparison operators
    def __eq__(self, other):
        return self.pluginInfo["name"] == other.pluginInfo["name"]

    def __ne__(self, other):
        return self.pluginInfo["name"] != other.pluginInfo["name"]
