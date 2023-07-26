import os
import sys
import typing
import json
import uuid
from HorusAPI import Plugin, PluginBlock, PluginPage
import io
from contextlib import redirect_stdout, redirect_stderr
import subprocess
import importlib.util
import pkg_resources
import shutil


# Define a overwrite exception
class OverwriteException(Exception):
    def __init__(self, name: str, path: str, message: str):
        """
        An exception that is raised when trying to overwrite a file.

        - name: The name of the file (without extension)
        - path: The path to the file (with extension)
        - message: The error message
        """
        super().__init__(message)
        self.name = name
        self.path = path


class PluginManager:
    """
    This class manages the installation, loading and uninstallation of plugins.
    It creates the AppSupport/Plugins directory if it doesn't exist.
    """

    # Track if the plugins need to be reloaded
    pluginChanges = True

    def __init__(self, appSupportDir: str, desktop: bool):
        # Get the plugins and dependencies directory
        self._pluginsDepsDir(appSupportDir)

        # Assign desktop mode (opening of files, folders...)
        self.desktop = desktop

        # Save the current working dir
        self.workingDir = os.getcwd()

    def loadPlugins(self):
        """
        Initializes the plugins after the app has started.
        """

        print("Loading plugins...")

        # Initialize the plugins
        self._initializePlugins()

    def _pluginsDepsDir(self, appSupportDir):
        """
        Creates the plugins and dependencies directory if they doesn't exist.
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
            # We are not in a bundle, use the AppSupport/DefaultPlugins directory
            self.defaultPluginsDir = os.path.join(appSupportDir, "DefaultPlugins")
            pass

        # Defines the plugins directory, which should be in the AppSupport directory
        self.pluginsDir = os.path.join(appSupportDir, "Plugins")
        if not os.path.exists(self.pluginsDir):
            os.mkdir(self.pluginsDir)

        # Defines the dependencies directory, which should
        # be in the AppSupport directory
        self.depsDir = os.path.join(appSupportDir, "Dependencies")
        if not os.path.exists(self.depsDir):
            os.mkdir(self.depsDir)

        # Add the dependencies directory to the PYTHON path
        sys.path.append(self.depsDir)

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
            raise Exception(e)

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

        plugin = self._getPlugin(pluginName)

        # Remove the plugin folder
        pluginPath = os.path.join(self.pluginsDir, plugin._path)
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
                # Define an error dummy plugin
                errorPlugin = Plugin(id=f"error.{basename}")
                errorPlugin.info = {
                    "name": os.path.basename(pth),
                    "description": str(e),
                    "author": "",
                    "version": "",
                    "dependencies": "",
                    "filename": os.path.basename(pth),
                }
                errorPlugin._path = pth
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

        # Dependencies for the plugin
        depsDir = os.path.join(pluginDir, "deps")

        # Create the deps folder
        if not os.path.exists(depsDir):
            os.mkdir(depsDir)

        try:
            # Set the python path to the dependencies folder
            sys.path.append(depsDir)
            # Install dependencies
            self._installDependencies(plugin, depsDir)
        finally:
            # Remove the python path to the dependencies folder
            sys.path.pop()

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

        # Install the plugin dependencies
        # self._installDependencies(pluginModule.plugin)

        # Return the loaded plugin instace
        return pluginModule.plugin

    def _installDependencies(self, plugin: Plugin, depsDir: str):
        """
        Installs the dependencies of a plugin.

        :param plugin: The plugin instance
        """

        dependencies = plugin.info.get("dependencies", [])
        installedDeps = os.listdir(depsDir)

        # Split installed dependencies to get the name of the package
        installedDeps = [d.split("-")[0] for d in installedDeps]

        # Iterate through the dependencies
        for dep in dependencies:
            # If the dependency is not installed, install it
            if dep not in installedDeps:
                print(
                    f"Installing dependency {dep} for plugin {plugin.info['name']}..."
                )
                self._installDepInternal(dep, depsDir)

    def _installDepInternal(self, dep: str, depsDir: str):
        with subprocess.Popen(
            [
                sys.executable,
                "-m",
                "pip",
                "install",
                dep,
                "--target",
                depsDir,
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        ) as p:
            if p.stdout is not None:
                for line in p.stdout:
                    print(line)
                    # emit("installPluginDep", line
            if p.stderr is not None:
                for line in p.stderr:
                    print(line)
                    # emit("installPluginDep", line)
            if p.returncode != 0 and p.returncode is not None:
                print(f"Dependency {dep} could not be installed.")
                raise Exception(f"Dependency {dep} could not be installed.")

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
            info["blocks"] = self._getBlocksFromList(p, p.blocks)
            listedPlugins.append(info)
        for ep in self.errorPlugins:
            info = ep.info
            info["actions"] = str(len(ep.actions) if ep.actions else 0)
            info["views"] = str(len(ep.views))
            errorPlugins.append(info)
        return {"plugins": listedPlugins, "errors": errorPlugins}

    def _getBlocksFromList(self, plugin: Plugin, blockList: list[PluginBlock]):
        newBlocks: list[dict[str, typing.Any]] = []
        for b in blockList:
            newBlock = b._toDict()
            newBlock["plugin"] = plugin.info["name"]
            # newBlock = {
            #     "id": b.id,
            #     "plugin": plugin.info["name"],
            #     "name": b.name,
            #     "description": b.description,
            #     "variables": self.getVariables(b),
            #     # Deprecated:
            #     # "subBlocks": self._getBlocksFromList(plugin, b.getSubBlocks()),
            #     "config": self._getConfigFromBlock(b),
            # }
            newBlocks.append(newBlock)

        return newBlocks

    # def _getConfigFromBlock(self, block: PluginBlock):
    #     configs = []
    #     for c in block.getConfigs():
    #         configs.append(
    #             c.toDict()
    #             # {
    #             #     "id": c.id,
    #             #     "name": c.name,
    #             #     "description": c.description,
    #             #     "variables": self.getVariables(c),
    #             # }
    #         )
    #     return configs

    def getBlocks(self):
        """
        Returns a list of all the blocks of all the plugins (without the configs).
        """
        self._initializePlugins()
        blocks: list[dict[str, typing.Any]] = []
        for p in self.loadedPlugins:
            blocks += self._getBlocksFromList(p, p.blocks)
        return blocks

    def getVariables(self, block: PluginBlock):
        """
        Returns a list of all the variables of a block.
        """
        varList: list[dict[str, typing.Any]] = []
        for v in block._getVariables():
            # Get the children of the variable
            varList.append(v.toDict())
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

    def executeBlock(self, blockID, variables, inputs, workingDir):
        """
        Executes an action of a plugin.
        """

        # Find the block
        block = self._findBlock(blockID)

        # Set the variables
        block._updateVariables(variables)

        # Set the inputs
        block._updateInputs(inputs)

        # Read the config file for the block
        configPath = self._blockConfigPath(block)

        if os.path.exists(configPath):
            # Set the config to execute the block
            block._updateConfigs(configPath)

        # Set the working dir to run python from
        os.chdir(os.path.dirname(workingDir))

        # Find the plugin
        plugin = self._getPluginByID(blockID.split(".")[0])

        # Add to the python path the dependencies folder of the plugin
        depsDir = os.path.join(plugin._path, "deps")
        sys.path.append(depsDir)

        # Capture all stdout and stderr output
        error = False
        errorMSG = ""
        with io.StringIO() as buf, redirect_stdout(buf), redirect_stderr(buf):
            # Execute the block
            outputs = None
            try:
                outputs = block()
            except Exception as e:
                print(f"Error executing block {blockID}: {e}")
                error = True
                errorMSG = str(e)

            # Get the output
            printOutput = buf.getvalue()

        # Print the output to the regular terminal
        print(printOutput)

        # Restore the working dir
        os.chdir(self.workingDir)

        # Restore the python path
        sys.path.pop()

        if error:
            raise Exception(printOutput + "\n" + errorMSG)

        # Return the output
        return outputs, printOutput

    def _saveFlowInternal(self, flow, overwrite=False):
        """
        Saves a flow to a file. (overwrites if already exists)
        """

        flowPath = flow["path"]

        # Read the savedID from the file if it exists
        overwriteCaution = False
        if os.path.exists(flowPath) and not overwrite:
            with open(flowPath, "r") as f:
                saved_flow = json.load(f)
                savedID = saved_flow.get("savedID")
                if savedID != flow.get("savedID"):
                    overwriteCaution = True

        # Create a new savedID if it doesn't exist or is "new_flow"
        if not flow.get("savedID") or flow["savedID"] == "new_flow":
            flow["savedID"] = str(uuid.uuid4())

        # Check if the savedID is the same as the current flow
        if overwriteCaution and not overwrite and not self.desktop:
            raise OverwriteException(
                name=flow["name"], path=flowPath, message="Trying to overwrite a flow."
            )

        # Set the current folder as the flow folder
        flow["path"] = flowPath

        # Save the flow (overwrite if already exists)
        with open(flowPath, "w") as f:
            json.dump(flow, f)

        # Return the saved flow
        return flow

    def saveFlow(self, flow):
        overwrite = flow.get("overwrite")

        flowPath = flow.get("path")
        if not flowPath and flow.get("savedID") == "new_flow" and not overwrite:
            if self.desktop:
                from App import AppDelegate

                filename = flow.get("name", "New flow") + ".flow"
                fileTypes = ("Flow (*.flow)",)
                flowPath = AppDelegate().saveFileSelectDialog(
                    filename, fileTypes=fileTypes
                )
                if not flowPath:
                    raise Exception("No path selected.")
                if not flowPath.endswith(".flow"):
                    flowPath += ".flow"
                flow["path"] = flowPath
                flow["name"] = os.path.basename(flowPath).replace(".flow", "")
            else:
                flowPath = os.path.join("flows", flow.get("name") + ".flow")
                overwrite = True
                flow["path"] = flowPath
        return self._saveFlowInternal(flow, overwrite)

    def _openFlowInternal(self, flowPath):
        """
        Opens a flow from a file.
        """

        # Read the flow file
        with open(flowPath, "r") as f:
            flow = json.load(f)

        # Set the flow path
        flow["path"] = flowPath

        # Return the flow
        return flow

    def openFlow(self):
        """
        Opens the file select dialog to open a flow.
        """
        if self.desktop:
            from App import AppDelegate

            flowPath = AppDelegate().openFileSelectDialog(
                allowMultiple=False, fileTypes=("Flow (*.flow)",)
            )

            if flowPath:
                if isinstance(flowPath, tuple):
                    flowPath = flowPath[0]
                return self._openFlowInternal(str(flowPath))
            else:
                return None
        else:
            # WIP implement server user folders
            return None

    def _getPageInfo(self, pg: PluginPage, p: Plugin):
        return {
            "id": pg.id,
            "plugin": p.info["name"],
            "name": pg.name,
            "description": pg.description,
            "html": f"{p._path}/Pages/{pg.html}",
            "url": f"/plugins/pages/{pg.id}",
        }

    def getPagesObject(self):
        """
        Returns a list of all the pages of all the plugins as Pages instances.
        """
        self._initializePlugins()
        pages: list[PluginPage] = []
        for p in self.loadedPlugins:
            for pg in p.pages:
                pg._pageInfo = self._getPageInfo(pg, p)
                pages.append(pg)
        return pages

    def getPages(self):
        """
        Returns a list of all the pages of all the plugins in JSON format.
        """
        self._initializePlugins()
        pages: list[dict[str, str]] = []
        for p in self.loadedPlugins:
            for pg in p.pages:
                pages.append(self._getPageInfo(pg, p))
        return pages

    # def _blocksPlusSubBlocks(self, plugin: Plugin):
    #     """
    #     Returns a list of all the blocks of a plugin, including the subblocks.
    #     """
    #     blocks = plugin.blocks
    #     for block in plugin.blocks:
    #         blocks += block.getSubBlocks()
    #     return blocks

    def _initConfig(self, plugin: Plugin):
        """
        Initializes the config file for the blocks of the plugin.
        """

        # allBlocks = self._blocksPlusSubBlocks(plugin)
        def initBlockConfig(block: PluginBlock):
            """
            Initializes the config file for a block.
            """
            # Get the path of the config file
            configPath = self._blockConfigPath(block)

            # If the config file does not exist, create it
            if not os.path.exists(configPath):
                block._createConfig(configPath)
            else:
                # If the config file exists, read it
                block._updateConfigs(configPath)

        # Loop through all the blocks
        for block in plugin.blocks:
            initBlockConfig(block)

            # # Loop through the subblocks
            # for subBlock in block.getSubBlocks():
            #     initBlockConfig(subBlock)

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
            blockID = ".".join(configId.split(".")[:-2])
            if "config" in blockID.split("."):
                blockID = ".".join(blockID.split(".")[:-1])
            block = plugin.getBlock(blockID)

            # Get the path of the config file
            configDir = os.path.join(plugin._path, "config")

            # Find the block config file
            blockConfigFile = os.path.join(configDir, f"{block.id}.json")

            valuesToSave = {}
            for variable in config["variables"]:
                valuesToSave[variable["id"]] = variable["value"]

            # Save the config
            block._saveConfig(blockConfigFile, valuesToSave)

            # Execute the config block
            pluginConfigID = blockID + ".config." + configId.split(".")[-1]
            configBlock = block._getConfig(pluginConfigID)

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

    def reloadPlugins(self):
        """
        Force the PluginManager to reload the plugins.
        """
        self.pluginChanges = True
        self._initializePlugins()
        print("Plugins reloaded.")
