import os


class PluginVariable:
    # Children of the Variable (more PluginVariable)
    children = []

    # The value of the variable
    value = None

    def __init__(self, name, description, type, defaultValue=None):
        self.name = name
        self.description = description
        self.type = type
        self.defaultValue = defaultValue


class PluginBlock:
    # Children of the Block (PluginVariable)
    children = []

    # The output that the block produces
    output = None

    # The input that the block receives
    input = None

    def __init__(self, name, description, type, defaultValue=None):
        self.name = name
        self.description = description


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

    pluginViews = []
    """
    Views that can be loaded from the GUI.
    Should be the path to the HTML file.
    """

    # Define comparison operators
    def __eq__(self, other):
        return self.pluginInfo["name"] == other.pluginInfo["name"]

    def __ne__(self, other):
        return self.pluginInfo["name"] != other.pluginInfo["name"]


class PluginManager:
    """
    This class manages the installation, loading and uninstallation of plugins.
    It creates the AppSupport/Plugins directory if it doesn't exist.
    """

    loadedPlugins = []

    def __init__(self, appSupportDir) -> None:
        self.pluginsDir = self.__pluginsDir(appSupportDir)

        # Initialize the plugins
        self.__initializePlugins()

    def __pluginsDir(self, appSupportDir):
        pluginsDir = os.path.join(appSupportDir, "Plugins")

        if not os.path.exists(pluginsDir):
            os.mkdir(pluginsDir)

        return pluginsDir

    def installPlugin(self):
        """
        Opens the file dialog to select a plugin file
        and installs it to the plugins folder.
        """
        from App import AppDelegate

        try:
            files = AppDelegate().openFileDialog(
                allowMultiple=True, fileTypes=("Horus plugins (*.hp)",)
            )
        except Exception as e:
            raise Exception(f"Failed to get plugin path: {e}")

        if not files:
            return

        for f in files:
            self.__installPlugin(f)

    def __installPlugin(self, path):
        import shutil

        # Get the name of the plugin
        pluginName = os.path.basename(path)

        # Remove the extension
        pluginName = os.path.splitext(pluginName)[0]

        # Create a folder with the same name as the plugin
        newPluginDir = os.path.join(self.pluginsDir, pluginName)

        if os.path.exists(newPluginDir):
            raise Exception(f"Plugin {os.path.basename(path)} already installed.")

        os.mkdir(newPluginDir)

        newPlugin = shutil.copy(path, newPluginDir)

        # If the plugin is provided in .hp format, unzip it
        if newPlugin.endswith(".hp"):
            # Unzip the plugin
            import zipfile

            with zipfile.ZipFile(newPlugin, "r") as zip_ref:
                zip_ref.extractall(newPluginDir)

            # Remove the .hp file
            os.remove(newPlugin)

        # Get the .py file
        newPlugin = os.path.join(newPluginDir, pluginName + ".py")

        try:
            self.__loadPlugin(newPlugin)
        except Exception as e:
            shutil.rmtree(newPluginDir)
            print(e)
            raise Exception(f"Error installing plugin {os.path.basename(path)}")

    def __getPlugin(self, byName: str):
        """
        Returns a plugin with the given name.
        """
        for p in self.loadedPlugins:
            if p.pluginInfo["name"] == byName:
                return p
        raise Exception(f"Plugin {byName} not found.")

    def uninstallPlugin(self, pluginName: str):
        """
        Uninstalls a plugin with the given name.
        """
        import shutil

        pDir = self.__getPlugin(pluginName).pluginInfo["filename"].replace(".py", "")
        pluginPath = os.path.join(self.pluginsDir, pDir)
        shutil.rmtree(pluginPath)

    def __listPluginsPaths(self):
        """
        Lists the plugins present in the plugins directory.
        """
        # List the directories present in the plugins directory
        installed = os.listdir(self.pluginsDir)

        # Filter the python files
        plugins = []
        for pl in installed:
            # Get the plugin file based on the folder name + .py
            pluginFile = os.path.join(self.pluginsDir, pl, pl + ".py")
            plugins.append(pluginFile)

        return plugins

    def __initializePlugins(self):
        """
        Initializes all the plugins present in the plugins directory.
        """
        self.loadedPlugins = []
        pluginPaths = self.__listPluginsPaths()
        for pth in pluginPaths:
            try:
                self.__loadPlugin(pth)
            except Exception as e:
                print(f"Error loading plugin {os.path.basename(pth)}: {e}")

    def __loadPlugin(self, pluginPath: str):
        """
        Loads a plugin from the given path.
        """

        try:
            plugin = self.__checkPlugin(pluginPath)
        except Exception as e:
            raise Exception(f"Error loading plugin {os.path.basename(pluginPath)}: {e}")

        self.loadedPlugins.append(plugin)

    def __checkPlugin(self, pluginPath):
        """
        Checks if a plugin is valid.

        :param pluginPath: The path to the plugin file
        """

        import imp

        # Load the plugin file and obtain the plugin variable
        try:
            pluginModule = imp.load_source("pluginFile", pluginPath)
        except Exception as e:
            raise Exception(f"Cannot access plugin file {pluginPath}: {e}")

        # Check that the plugin variable exists
        if not hasattr(pluginModule, "plugin"):
            raise Exception("The plugin has not declared a plugin variable.")

        # Check that the plugin variable is a Plugin instance
        if not isinstance(pluginModule.plugin, Plugin):
            raise Exception("The plugin does not contain a valid plugin instance.")

        # Check that the plugin variable has a name
        if not pluginModule.plugin.pluginInfo["name"]:
            raise Exception("The plugin does not have a name.")

        # Add to the pluginInfo the filename
        pluginModule.plugin.pluginInfo["filename"] = os.path.basename(pluginPath)

        # Return the loaded plugin instace
        return pluginModule.plugin

    def listLoaded(self):
        """
        Returns a list of all the loaded plugins.
        """
        self.__initializePlugins()
        listedPlugins = []
        for p in self.loadedPlugins:
            info = p.pluginInfo
            info["actions"] = len(p.pluginActions)
            info["views"] = len(p.pluginViews)
            listedPlugins.append(info)
        return listedPlugins
