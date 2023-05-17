import os
import sys


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


class PluginManager:
    """
    This class manages the installation, loading and uninstallation of plugins.
    It creates the AppSupport/Plugins directory if it doesn't exist.
    """

    loadedPlugins = []

    def __init__(self) -> None:
        self.appSupportDir = self.__appSupportDir()
        self.pluginsDir = self.__pluginsDir()

        # Initialize the plugins
        self.__initializePlugins()

        print("Loaded plugins:")
        for p in self.loadedPlugins:
            print(f" - {p.pluginInfo['name']}")

    def __pluginsDir(self):
        pluginsDir = os.path.join(self.appSupportDir, "Plugins")

        if not os.path.exists(pluginsDir):
            os.mkdir(pluginsDir)

        return pluginsDir

    def __appSupportDir(self):
        try:
            appSupportDir = os.path.join(sys._MEIPASS, "AppSupport")
        except AttributeError:
            appSupportDir = os.path.join("AppSupport")

        appSupportDir = os.path.abspath(appSupportDir)

        if not os.path.exists(appSupportDir):
            os.mkdir(appSupportDir)

        return appSupportDir

    def installPlugin(self):
        """
        Opens the file dialog to select a plugin file 
        and installs it to the plugins folder.
        """
        from App import AppDelegate

        try:
            files = AppDelegate().openFileDialog(
                allowMultiple=True, fileTypes=(("Python files (*.py)"),)
            )
        except Exception as e:
            raise Exception(f"Failed to get plugins path: {e}")

        for f in files:
            self.__installPlugin(f)

    def __installPlugin(self, path):
        import shutil

        newPlugin = shutil.copy(path, self.pluginsDir)
        try:
            self.__loadPlugin(newPlugin)
        except Exception as e:
            os.remove(newPlugin)
            raise Exception(f"Error installing plugin {os.path.basename(path)}: {e}")

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
        import os

        pluginFile = self.__getPlugin(pluginName).pluginInfo["filename"]
        pluginPath = os.path.join(self.pluginsDir, pluginFile)
        os.remove(pluginPath)

    def __listPluginsPaths(self):
        """
        Lists the plugins present in the plugins directory.
        """
        # List the files present in the plugins directory
        pluginFiles = os.listdir(self.pluginsDir)

        # Filter the python files
        plugins = []
        for pf in pluginFiles:
            if pf.endswith(".py"):
                fullPath = os.path.abspath(os.path.join(self.pluginsDir, pf))
                plugins.append(fullPath)

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
            listedPlugins.append(info)
        return listedPlugins
