import os
import sys
import typing
from HorusAPI import Plugin, PluginBlock
import io
from contextlib import redirect_stdout, redirect_stderr


class PluginManager:
    """
    This class manages the installation, loading and uninstallation of plugins.
    It creates the AppSupport/Plugins directory if it doesn't exist.
    """

    # Track if the plugins need to be reloaded
    pluginChanges = True

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

        self.pluginChanges = True

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

        # Search in the error plugins
        for p in self.errorPlugins:
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

        self.pluginChanges = True
        self._initializePlugins()

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

        # Check if its necessary to re-load the plugins
        if not self.pluginChanges:
            return

        self.loadedPlugins: list[Plugin] = []
        self.errorPlugins: list[Plugin] = []
        pluginPaths = self._listPluginsPaths()
        for pth in pluginPaths:
            try:
                self._loadPlugin(pth)
            except Exception as e:
                basename = os.path.basename(pth)
                print(f"Error loading plugin {basename}: {e}")
                # Define an error dummy plugin
                errorPlugin = Plugin(id=f"error.{basename}")
                errorPlugin.info = {
                    "name": os.path.basename(pth),
                    "description": "Error loading plugin",
                    "author": "",
                    "version": "",
                    "dependencies": "",
                    "filename": os.path.basename(pth),
                }
                self.errorPlugins.append(errorPlugin)

        self.pluginChanges = False

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

        # Get the folder path
        pluginDir = os.path.dirname(pluginPath)

        # Create the config folder
        configDir = os.path.join(pluginDir, "config")

        if not os.path.exists(configDir):
            os.mkdir(configDir)

        self.loadedPlugins.append(plugin)

        # Init the plugin config
        self._initConfig(plugin)

    def _checkPlugin(self, pluginPath) -> Plugin:
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

        # Add to the plugin the filename
        pluginModule.plugin._filename = os.path.basename(pluginPath)

        # Add to the plugin the full path of the containing folder
        pluginModule.plugin._path = os.path.dirname(pluginPath)

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

    def getPlugins(self):
        """
        Returns a list of all the loaded plugins (blocks + configs).
        """
        self._initializePlugins()
        listedPlugins = []
        errorPlugins = []
        for p in self.loadedPlugins:
            info = p.info
            info["actions"] = str(len(p.actions) if p.actions else 0)
            info["views"] = str(len(p.views))
            info["id"] = p.id

            # List the blocks
            blocks = []
            for b in p.blocks:
                # List configuration blocks
                configs = []
                for c in b.getConfigs():
                    configs.append(
                        {
                            "id": c.id,
                            "name": c.name,
                            "description": c.description,
                            "variables": self.getVariables(c),
                        }
                    )

                blocks.append(
                    {
                        "id": b.id,
                        "name": b.name,
                        "description": b.description,
                        "variables": self.getVariables(b),
                        "config": configs,
                    }
                )
            info["blocks"] = blocks

            listedPlugins.append(info)
        for ep in self.errorPlugins:
            info = ep.info
            info["actions"] = str(len(ep.actions) if ep.actions else 0)
            info["views"] = str(len(ep.views))
            errorPlugins.append(info)
        return {"plugins": listedPlugins, "errors": errorPlugins}

    def getBlocks(self):
        """
        Returns a list of all the blocks of all the plugins (without the configs).
        """
        self._initializePlugins()
        blocks: list[dict[str, typing.Any]] = []
        for p in self.loadedPlugins:
            for b in p.blocks:
                blocks.append(
                    {
                        "id": b.id,
                        "plugin": p.info["name"],
                        "name": b.name,
                        "description": b.description,
                        "variables": self.getVariables(b),
                    }
                )
        return blocks

    def getVariables(self, block: PluginBlock):
        """
        Returns a list of all the variables of a block.
        """
        varList: list[dict[str, typing.Any]] = []
        for v in block.getVariables():
            # Get the children of the variable
            varList.append(
                {
                    "name": v.name,
                    "id": v.id,
                    "description": v.description,
                    "type": v.type,
                    "value": ""
                    if v.defaultValue is None
                    else v.defaultValue
                    if not v.value
                    else v.value,
                    "children": v.getChildren(),
                    "allowedValues": v.allowedValues,
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

        # Read the config file for the block
        configPath = self._blockConfigPath(block)

        if os.path.exists(configPath):
            # Set the config to execute the block
            block.updateConfigs(configPath)

        # Capture all stdout and stderr output
        with io.StringIO() as buf, redirect_stdout(buf), redirect_stderr(buf):
            # Execute the block
            block()

            # Get the output
            output = buf.getvalue()

        # Return the output
        return output

    def createFlow(self, name):
        """
        Creates a new flow.
        """

        # If we are in desktop, a window will open to select the flow destination folder
        if self.desktop:
            from App import AppDelegate

            flowPath = AppDelegate().saveFileSelectDialog()
            flowPath = os.path.join(flowPath, name)
        else:
            # If we are in web version instead,
            # the flow will be sabed to the user's flows folder
            # WIP
            flowPath = "flows"

        # Create the flow file
        if not os.path.exists(flowPath):
            os.mkdir(flowPath)

    def saveFlow(self, flow):
        """
        Saves a flow to a file.
        """
        pass

    def loadFlow(self, flowPath):
        """
        Loads a flow from a file.
        """
        pass

    def getPages(self):
        """
        Returns a list of all the pages of all the plugins.
        """
        self._initializePlugins()
        pages: list[dict[str, str]] = []
        for p in self.loadedPlugins:
            for pg in p.pages:
                pages.append(
                    {
                        "id": pg.id,
                        "plugin": p.info["name"],
                        "name": pg.name,
                        "description": pg.description,
                        "html": f"{p._path}/Pages/{pg.html}",
                        "url": f"/plugins/pages/{pg.id}",
                    }
                )
        return pages

    def _initConfig(self, plugin: Plugin):
        """
        Initializes the config file for the blocks of the plugin.
        """

        # Loop through all the blocks
        for block in plugin.blocks:
            # Get the path of the config file
            configPath = self._blockConfigPath(block)

            # If the config file does not exist, create it
            if not os.path.exists(configPath):
                block.createConfig(configPath)
            else:
                # If the config file exists, read it
                block.updateConfigs(configPath)

    def _blockConfigPath(self, block: PluginBlock):
        """
        Returns the path of the config file for a block.
        """

        # Find the plugin folder
        pluginID = block.id.split(".")[0]
        plugin = self._getPluginByID(pluginID)

        configDir = os.path.join(plugin._path, "config")

        # Find the block config file
        blockConfigFile = os.path.join(configDir, f"{block.id}.json")

        return blockConfigFile

    def saveConfig(self, config: dict[str, typing.Any]):
        """
        Saves the config to the config file.
        """

        # Loop through the newConfig array
        newConfig = config["newConfig"]
        output = ""
        for config in newConfig:
            # Get the ID of the config block
            configId = config["id"]

            # Get the plugin and the block
            pluginID = configId.split(".")[0]
            plugin = self._getPluginByID(pluginID)
            blockID = pluginID + "." + configId.split(".")[1]
            block = plugin.getBlock(blockID)

            # Get the path of the config file
            configDir = os.path.join(plugin._path, "config")

            # Find the block config file
            blockConfigFile = os.path.join(configDir, f"{block.id}.json")

            valuesToSave = {}
            for variable in config["variables"]:
                valuesToSave[variable["id"]] = variable["value"]

            # Save the config
            block.saveConfig(blockConfigFile, valuesToSave)

            # Execute the config block
            pluginConfigID = blockID + ".config." + configId.split(".")[3]
            configBlock = block.getConfig(pluginConfigID)

            with io.StringIO() as buf, redirect_stdout(buf), redirect_stderr(buf):
                # Execute the config block
                configBlock()

                # Get the output
                output += buf.getvalue()

        # Reload the plugins
        self.pluginChanges = True
        self._initializePlugins()

        # Return the output to print in horusterm
        return output
