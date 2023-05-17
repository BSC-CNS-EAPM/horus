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

    pluginInfo = {
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

    pluginActions = []
    """
    Functions that can be called from the GUI.
    """

    # Define comparison operators
    def __eq__(self, other):
        return self.pluginInfo["name"] == other.pluginInfo["name"]

    def __ne__(self, other):
        return self.pluginInfo["name"] != other.pluginInfo["name"]
