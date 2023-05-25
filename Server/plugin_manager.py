import os
import sys
from HorusAPI import Plugin, PluginBlock


class PluginManager:
    """
    This class manages the installation, loading and uninstallation of plugins.
    It creates the AppSupport/Plugins directory if it doesn't exist.
    """

    def __init__(self, appSupportDir: str, desktop: bool) -> None:
        self._pluginsDir(appSupportDir)

        self.desktop = desktop

        # Initialize the plugins
        self._initializePlugins()

    def _pluginsDir(self, appSupportDir):
        """
        Creates the plugins directory if it doesn't exist.
        - appSupportDir: The path to the AppSupport directory
        """

        # Defines the default plugins directory, which should be in the same
        # directory as the executable bundle
        try:
            bundle_dir = sys._MEIPASS  # type: ignore
            self.defaultPluginsDir = os.path.abspath(
                os.path.join(bundle_dir, "DefaultPlugins")
            )
        except AttributeError:
            # We are not in a bundle
            pass

        # Defines the plugins directory, which should be in the AppSupport directory
        self.pluginsDir = os.path.join(appSupportDir, "Plugins")
        if not os.path.exists(self.pluginsDir):
            os.mkdir(self.pluginsDir)

    def installPlugin(self):
        """
        Opens the file dialog to select a plugin file
        and installs it to the plugins folder.
        """
        from App import AppDelegate

        try:
            files = AppDelegate().openFileSelectDialog(
                allowMultiple=True, fileTypes=("Horus plugins (*.hp;*.py)",)
            )
        except Exception as e:
            raise Exception(f"Failed to get plugin path: {e}")

        if not files:
            return

        for f in files:
            self._installPlugin(f)

    def _installPlugin(self, path):
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
            self._loadPlugin(newPlugin)
        except Exception as e:
            shutil.rmtree(newPluginDir)
            print(e)
            raise Exception(f"Error installing plugin {os.path.basename(path)}")

    def _getPlugin(self, byName: str) -> Plugin:
        """
        Returns a plugin with the given name.
        """
        for p in self.loadedPlugins:
            if p.info["name"] == byName:
                return p
        raise Exception(f"Plugin {byName} not found.")
    
    def _getPluginByID(self, id: str) -> Plugin:
        """
        Returns a plugin with the given name.
        """
        for p in self.loadedPlugins:
            if p.id == id:
                return p
        raise Exception(f"PluginID {id} not found.")

    def uninstallPlugin(self, pluginName: str):
        """
        Uninstalls a plugin with the given name.
        """
        import shutil

        pDir = self._getPlugin(pluginName).info["filename"].replace(".py", "")
        pluginPath = os.path.join(self.pluginsDir, pDir)
        shutil.rmtree(pluginPath)

    def _listPluginsPaths(self):
        """
        Lists the plugins present in the plugins directory.
        """

        # List the directories present in the plugins directory
        installed = os.listdir(self.pluginsDir)

        # List the directories present in the default plugins directory
        try:
            defaultPlugins = os.listdir(self.defaultPluginsDir)
            installed += defaultPlugins
        except AttributeError:
            # We are not in a bundle
            defaultPlugins = []

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

        for pl in defaultPlugins:
            # Get the plugin file based on the folder name + .py
            pluginFile = os.path.join(self.defaultPluginsDir, pl, pl + ".py")
            # Check if the plugin file exists
            # (this is needed because in macOS .DS_Store.py files are
            # listed but don't exist)
            if os.path.exists(pluginFile):
                plugins.append(pluginFile)

        return plugins

    def _initializePlugins(self):
        """
        Initializes all the plugins present in the plugins directory.
        """
        self.loadedPlugins: list[Plugin] = []
        self.errorPlugins: list[str] = []
        pluginPaths = self._listPluginsPaths()
        for pth in pluginPaths:
            try:
                self._loadPlugin(pth)
            except Exception as e:
                print(f"Error loading plugin {os.path.basename(pth)}: {e}")
                self.errorPlugins.append(os.path.basename(pth))

    def _loadPlugin(self, pluginPath: str):
        """
        Loads a plugin from the given path.
        """

        try:
            plugin = self._checkPlugin(pluginPath)
        except Exception as e:
            raise Exception(f"Error loading plugin {os.path.basename(pluginPath)}: {e}")

        # Check that the plugin is not already loaded
        for p in self.loadedPlugins:
            if p == plugin:
                return

        self.loadedPlugins.append(plugin)

    def _checkPlugin(self, pluginPath):
        """
        Checks if a plugin is valid.

        :param pluginPath: The path to the plugin file
        """

        import importlib.util

        # Load the plugin file and obtain the plugin variable
        spec = importlib.util.spec_from_file_location("pluginFile", pluginPath)
        if spec is None:
            raise Exception(f"Failed to create module spec for {pluginPath}")
        pluginModule = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(pluginModule)  # type: ignore

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

        # Check if the plugin is a default plugin
        try:
            if pluginPath.startswith(self.defaultPluginsDir):
                pluginModule.plugin.info["default"] = True
            else:
                pluginModule.plugin.info["default"] = False
        except AttributeError:
            # We are not in a bundle
            pass

        # Return the loaded plugin instace
        return pluginModule.plugin

    def listLoaded(self):
        """
        Returns a list of all the loaded plugins.
        """
        self._initializePlugins()
        listedPlugins = []
        for p in self.loadedPlugins:
            info = p.info
            info["actions"] = str(len(p.actions) if p.actions else 0)
            info["views"] = str(len(p.views))
            listedPlugins.append(info)
        return {"plugins": listedPlugins, "errors": self.errorPlugins}

    # def listPluginBlocks(self, plugin):
    #     """
    #     Returns a list of all the blocks of a plugin.
    #     """
    #     return plugin.blocks

    def listAllBlocks(self):
        """
        Returns a list of all the blocks of all the plugins.
        """
        self._initializePlugins()
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
        for v in block.listVariables():
            # Get the children of the variable
            varList.append(
                {
                    "name": v.name,
                    "id": v.id,
                    "description": v.description,
                    "type": v.type,
                    "value": v.defaultValue if v.defaultValue else "",
                    "children": v.getChildren(),
                    "allowedValues": v.allowedValues
                }
            )
        return varList
    
    def _findBlock(self, fromBlockID: str):
        """
        Finds a block from an action id.
        """
        # Split the id
        pluginID = fromBlockID.split(".")[0]

        # Find the plugin
        try:
            plugin = self._getPluginByID(pluginID)
        except Exception:
            raise Exception(f"PluginID {pluginID} not found")

        # Get the block
        try:
            block = plugin.getBlock(fromBlockID)
        except Exception:
            raise Exception(f"Block {fromBlockID} not found")

        return block


    def executeBlock(self, blockID, variables):
        """
        Executes an action of a plugin.
        """

        # Find the block
        block = self._findBlock(blockID)

        # Set the variables
        block.updateValues(variables)

        # Execute the block
        block()

    def createFlow(self, name):
        """
        Creates a new flow.
        """

        # If we are in desktop, a window will open to select the flow destination folder
        if self.desktop:
            from App import AppDelegate
            flowPath = AppDelegate().openFolderSelectDialog()
            flowPath = os.path.join(flowPath, name)
        else:
            # If we are in web version instead, 
            # the flow will be sabed to the user's flows folder
            # WIP
            flowPath = "flows"

        # Create the flow folder
        # if not os.path.exists(flowPath):
        #     os.mkdir(flowPath)

    def saveFlow(self, flow):
        """
        Saves a flow to a file.
        """
        pass

