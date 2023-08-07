import os
import sys
import typing
from HorusAPI import Plugin, PluginBlock, PluginPage
import io
from contextlib import redirect_stdout, redirect_stderr
import subprocess

# from eventlet.green import subprocess
import importlib.util
import shutil
from flask_socketio import SocketIO
import json


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
        # self.depsDir = os.path.join(appSupportDir, "Dependencies")
        # if not os.path.exists(self.depsDir):
        #     os.mkdir(self.depsDir)

        # # Add the dependencies directory to the PYTHON path
        # sys.path.append(self.depsDir)

    def installPlugin(self, socketio: SocketIO):
        """
        Opens the file dialog to select a plugin file
        and installs it to the plugins folder.
        """
        from App import AppDelegate

        try:
            files = AppDelegate().openFileSelectDialog(
                allowMultiple=True, fileTypes=("Horus plugins (*.hp)",)
            )
        except Exception as e:
            raise Exception(f"Failed to get plugin path: {e}")

        if not files:
            return

        for f in files:
            with PrintCapturer(socketio, "installPluginDep"):
                print("Installing plugin: " + f)
                self._installPlugin(f)

        self.pluginChanges = True

    def _installPlugin(self, path):
        # Get the name of the plugin
        pluginName = os.path.basename(path)

        # Remove the extension
        pluginName = os.path.splitext(pluginName)[0]

        # Create a folder with the same name as the plugin
        newPluginDir = os.path.join(self.pluginsDir, "tmpInstall")

        if os.path.exists(newPluginDir):
            raise Exception(
                f"Plugin with name {os.path.basename(path)} already installed."
            )

        os.mkdir(newPluginDir)

        print("Copying plugin to tmp folder...")

        newPlugin = shutil.copy(path, newPluginDir)

        # If the plugin is provided in .hp format, unzip it
        if newPlugin.endswith(".hp"):
            print("Unzipping plugin...")

            # Unzip the plugin
            import zipfile

            with zipfile.ZipFile(newPlugin, "r") as zip_ref:
                zip_ref.extractall(newPluginDir)

            # Remove the .hp file
            os.remove(newPlugin)
        else:
            raise Exception("Invalid plugin format. (.hp expected)")

        # Get the .py file
        # newPlugin = os.path.join(newPluginDir, pluginName + ".py")

        try:
            print("Checking plugin...")
            loadedPlugin = self._loadPlugin(newPluginDir)
            # If everything went correct, move the plugin to its folder
            pluginFinalPath = os.path.join(self.pluginsDir, loadedPlugin.id)
            if not os.path.exists(pluginFinalPath):
                print("Saving plugin to its folder...")
                shutil.move(newPluginDir, pluginFinalPath)
            else:
                raise Exception(
                    f"Plugin {loadedPlugin.id} already exists.\
                    Uninstall it first to install the new version."
                )
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
        plugins = [
            os.path.join(self.pluginsDir, p)
            for p in os.listdir(self.pluginsDir)
            if not p.startswith(".")
        ]

        # List the directories present in the default plugins directory
        defaultPlugins = [
            os.path.join(self.defaultPluginsDir, p)
            for p in os.listdir(self.defaultPluginsDir)
            if not p.startswith(".")
        ]
        plugins += defaultPlugins

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

    def _loadPlugin(self, pluginPath: str) -> Plugin:
        """
        Loads a plugin from the given path.

        :param pluginPath: The path to the plugin folder
        """

        if not os.path.isdir(pluginPath):
            raise Exception(f"Plugin {pluginPath} must be a directory.")

        try:
            plugin = self._checkPlugin(pluginPath)
        except Exception as e:
            raise Exception(f"Error loading plugin: {e}")

        # Check that the plugin is not already loaded
        for p in self.loadedPlugins:
            if p == plugin:
                return

        # Create the config folder
        configDir = os.path.join(pluginPath, "config")

        if not os.path.exists(configDir):
            os.mkdir(configDir)

        # Add the plugin to the loaded plugins
        self.loadedPlugins.append(plugin)

        # Init the plugin config
        self._initConfig(plugin)

        # Return the plugin in case its needed
        return plugin

    def _checkPlugin(self, pluginDir) -> Plugin:
        """
        Checks if a plugin is valid.

        :param pluginPath: The path to the plugin folder
        """

        # Load the plugin.meta
        pluginMeta = os.path.join(pluginDir, "plugin.meta")
        if not os.path.exists(pluginMeta):
            raise Exception("The plugin does not contain a plugin.meta file.")

        # Load the plugin.meta
        with open(pluginMeta, "r") as f:
            pluginMeta = json.load(f)

        # Dependencies for the plugin
        depsDir = os.path.join(pluginDir, "deps")

        # Create the deps folder
        if not os.path.exists(depsDir):
            os.mkdir(depsDir)

        # Set the python path to the dependencies folder
        sys.path.append(depsDir)

        # Install dependencies
        self._installDependencies(pluginMeta, depsDir)

        # Get the entry point from meta
        entryPoint = pluginMeta.get("pluginFile", None)
        if entryPoint is None:
            raise Exception("The plugin does not contain a pluginFile entry.")

        pluginPath = os.path.join(pluginDir, entryPoint)

        # Load the plugin file and obtain the plugin variable
        spec = importlib.util.spec_from_file_location("pluginFile", pluginPath)
        if spec is None:
            raise Exception(f"Failed to create module spec for {entryPoint}")
        pluginModule = importlib.util.module_from_spec(spec)
        try:
            spec.loader.exec_module(pluginModule)  # type: ignore
        except Exception as e:
            raise Exception(f"Failed to load plugin {entryPoint}: {e}")
        finally:
            # Pop the appended deps dir from the sys.path
            sys.path.pop()
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

        # With the path set, load the metadata
        pluginModule.plugin.loadPluginMeta()

        # Check if the plugin is a default plugin
        if pluginPath.startswith(self.defaultPluginsDir):
            pluginModule.plugin.info["default"] = True
        else:
            pluginModule.plugin.info["default"] = False

        # Return the loaded plugin instace
        return pluginModule.plugin

    def _installDependencies(self, pluginMeta: typing.Dict[str, str], depsDir: str):
        """
        Installs the dependencies of a plugin.

        :param plugin: The plugin meta info
        :param depsDir: The path to the dependencies folder
        """

        dependencies = pluginMeta.get("dependencies", [])
        pluginName = pluginMeta.get("name", "Unknown")
        listedDeps = os.listdir(depsDir)

        # Get the installed dependencies
        installedDeps = {}
        for idep in listedDeps:
            if ".dist-info" not in idep:
                continue
            name = idep.split("-")[0].lower()
            version = idep.split("-")[1].split(".dist")[0]
            installedDeps[name] = version

        # Iterate through the required dependencies
        for dep in dependencies:
            name = dep.split("==")[0].lower()
            version = dep.split("==")[1] if "==" in dep else None

            exists = installedDeps.get(name, None)

            if exists is None:
                print(f"Installing dependency {dep} for plugin {pluginName}...")
                self._installDepInternal(dep, depsDir)
                continue

            if exists != version and version is not None:
                print(f"Upgrading dependency {dep} for plugin {pluginName}...")
                self._installDepInternal(dep, depsDir)

    def _installDepInternal(self, dep: str, depsDir: str):
        """
        Installs a dependency for a plugin.

        :param dep: The dependency to install
        :param depsDir: The path to the dependencies folder
        """

        # First check that the user has a valid
        # python interpreter when the app is frozen
        # Unfortunately, PyInstaller does not include
        # the python interpreter in the bundle, therefore
        # to install dependencies we need to use the system
        # python interpreter. If the user does not have a
        # valid python interpreter, we cannot install dependencies
        # and we need to raise an exception.
        interpreter = "python"
        try:
            # Get the interpreter from the user settings
            from App import AppDelegate

            interpreter = (
                AppDelegate().appSettings.getSetting("dependenciesInterpreter").value
            )
        except Exception as e:
            msg = f"Could not get the python interpreter from the user settings: {e}"
            msg += "\nDefaulting to system python interpreter."
            print(msg)

        # Check if the app is frozen
        if getattr(sys, "frozen", False):
            # Check if the python interpreter is valid
            p = subprocess.Popen(
                [interpreter, "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
            )

            # Wait for the process to finish
            p.wait()

            # Get the result
            try:
                version = p.stdout.read().decode("utf-8").strip().split(" ")[-1]
            except Exception as e:
                raise Exception(
                    f"Could not get the intalled python interpreter version: {e}."
                )

            from App import AppDelegate

            appPythonVersion = AppDelegate().APP_INFO["PYTHON_VERSION"]

            exceptionMsg = (
                "In order to install additional dependencies, "
                "you need to have a valid python interpreter "
                f"installed on your system with python v{appPythonVersion}. "
                "You can select a specific interpreter in the settings."
            )

            # Check the return code
            if p.returncode != 0 and p.returncode is not None:
                raise Exception(exceptionMsg)

            if version != appPythonVersion:
                exceptionMsg += f" (Currently detected python v{version})"
                raise Exception(exceptionMsg)

        with subprocess.Popen(
            [
                interpreter,
                "-m",
                "pip",
                "install",
                dep,
                "--target",
                depsDir,
                "--upgrade",
                "--no-input",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            stdin=subprocess.PIPE,
        ) as p:
            # Print the output
            for line in p.stdout:
                strippedOut = line.decode("utf-8").strip()
                if strippedOut != "":
                    print(strippedOut)

            # Print the error
            if p.stderr:
                for line in p.stderr:
                    strippedErr = line.decode("utf-8").strip()
                    if strippedErr != "":
                        print(strippedErr)

            # Wait for the process to finish
            p.wait()

            # Check the return code
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

    def executeBlock(
        self,
        blockID,
        variables,
        inputs,
        workingDir,
        socketio: SocketIO,
    ):
        """
        Executes an action of a plugin.

        :param blockID: The id of the block to execute.
        :param variables: The variables of the block.
        :param inputs: The inputs of the block.
        :param workingDir: The working directory to execute the block.
        :param selectedRemote: If any, the remote where to execute the block.
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

        # Get the cluster api from the app delegate
        from App import AppDelegate

        rAPI = AppDelegate().remote

        # Update the block with the remote configuration
        block._setRemote(rAPI)

        # Execute the block
        error = False
        errorMSG = ""
        outputs = None
        try:
            with PrintCapturer(socketio):
                outputs = block()
        except Exception as e:
            error = True
            errorMSG = str(e)

        # Restore the working dir
        os.chdir(self.workingDir)

        # Restore the python path
        sys.path.pop()

        if error:
            raise Exception(errorMSG)

        # Return the output of the block
        return outputs

    def _getPageInfo(self, pg: PluginPage, p: Plugin):
        return {
            "id": pg.id,
            "plugin": p.info["name"],
            "name": pg.name,
            "description": pg.description,
            "html": f"{p._path}/Pages/{pg.html}",
            "url": f"/plugins/pages/{pg.id}",
            "deps": os.path.join(p._path, "deps"),
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

    def listFlows(self):
        """
        Returns a list of the default flows provided by the plugins
        """

        flows = []
        # Load the predefined flows
        for p in self.loadedPlugins:
            flows += p._flows

        return flows

    def loadPredefinedFlow(self, savedID: str):
        """
        Returns a predefined flow with the given savedID.
        """

        flows = self.listFlows()
        loadedFLow = None
        for f in flows:
            if f["savedID"] == savedID:
                from App import AppDelegate

                loadedFLow = AppDelegate()._openFlowInternal(f["path"])
                break
        if not loadedFLow:
            raise Exception("Flow not found.")

        # Replace the savedID and the flow path so
        # the forntend can save it to another location
        loadedFLow["savedID"] = "new_flow"
        loadedFLow["path"] = None

        return loadedFLow


class PrintCapturer:
    def __init__(self, socketio: SocketIO, printTo: str = "printTerm"):
        self.socketio = socketio
        self.printTo = printTo

    def write(self, message):
        self.socketio.emit(self.printTo, message)
        self.old_stdout.write(message)
        self.socketio.sleep(0)

    def flush(self):
        self.old_stdout.flush()

    def __enter__(self):
        self.old_stdout = sys.stdout
        self.old_stderr = sys.stderr
        sys.stdout = self
        sys.stderr = self

    def __exit__(self, exc_type, exc_value, traceback):
        sys.stdout = self.old_stdout
        sys.stderr = self.old_stderr
