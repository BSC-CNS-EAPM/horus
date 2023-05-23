import os
from HorusAPI import Plugin, PluginBlock, PluginVariable


class PluginManager:
    """
    This class manages the installation, loading and uninstallation of plugins.
    It creates the AppSupport/Plugins directory if it doesn't exist.
    """

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
                allowMultiple=True, fileTypes=("Horus plugins (*.hp;*.py)",)
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

    def __getPlugin(self, byName: str) -> Plugin:
        """
        Returns a plugin with the given name.
        """
        for p in self.loadedPlugins:
            if p.info["name"] == byName:
                return p
        raise Exception(f"Plugin {byName} not found.")

    def uninstallPlugin(self, pluginName: str):
        """
        Uninstalls a plugin with the given name.
        """
        import shutil

        pDir = self.__getPlugin(pluginName).info["filename"].replace(".py", "")
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
            # Check if the plugin file exists 
            # (this is needed because in macOS .DS_Store.py files are 
            # listed but don't exist)
            if os.path.exists(pluginFile):
                plugins.append(pluginFile)

        return plugins

    def __initializePlugins(self):
        """
        Initializes all the plugins present in the plugins directory.
        """
        self.loadedPlugins: list[Plugin] = []
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


        # Check that the plugin is not already loaded
        for p in self.loadedPlugins:
            if p == plugin:
                return

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
        if not pluginModule.plugin.info["name"]:
            raise Exception("The plugin does not have a name.")

        # Add to the info the filename
        pluginModule.plugin.info["filename"] = os.path.basename(pluginPath)

        # Return the loaded plugin instace
        return pluginModule.plugin

    def listLoaded(self):
        """
        Returns a list of all the loaded plugins.
        """
        self.__initializePlugins()
        listedPlugins = []
        for p in self.loadedPlugins:
            info = p.info
            info["actions"] = str(len(p.actions) if p.actions else 0)
            info["views"] = str(len(p.views))
            listedPlugins.append(info)
        return listedPlugins

    # def listPluginBlocks(self, plugin):
    #     """
    #     Returns a list of all the blocks of a plugin.
    #     """
    #     return plugin.blocks

    def listAllBlocks(self):
        """
        Returns a list of all the blocks of all the plugins.
        """
        self.__initializePlugins()
        blocks = []
        for p in self.loadedPlugins:
            for b in p.blocks:
                blocks.append(
                    {
                        "id": b.id,
                        "plugin": p.info["name"],
                        "name": b.name,
                        "description": b.description,
                        "variables": self.listVariables(b),
                    }
                )
        return blocks

    def listVariables(self, block: PluginBlock):
        """
        Returns a list of all the variables of a block.
        """
        varList = []
        for v in block.variables:
            # Get the children of the variable
            varList.append({
                "name": v.name,
                "description": v.description,
                "type": v.type,
                "defaultValue": v.defaultValue,
                "children": v.getChildren()
            })
        return varList
    
    def executeAction(self, actionID, variables):
        """
        Executes an action of a plugin.
        """

        # Split the id
        pluginName, blockName, actionName = actionID.split(".")

        # Find the plugin
        plugin = self.__getPlugin(pluginName)

        # Get the block


