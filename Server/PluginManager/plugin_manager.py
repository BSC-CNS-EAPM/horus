"""
The PluginManager module contains the PluginManager class. This class
manages the installation, loading and uninstallation of plugins. Most
importantly, it manages the execution of the individual blocks of the plugins.
"""

# Standard imports
import os
import sys
import typing
import io
import subprocess
import logging
import json
import shutil
import datetime

# Type for modules in PluginDeps context manager
from types import ModuleType

# Importing the plugin classes directly from the plugin file
import importlib.util

# For the PrintCapturer class
from contextlib import redirect_stdout, redirect_stderr

# For the PluginDeps class
import pkg_resources

# For the SocketIO type completion
from flask_socketio import SocketIO
import flask_login

# Plugin deps context manager, forking the process prevents
# importend modules from being imported twice
import multiprocess as mp

# More types from the HorusAPI
from HorusAPI import Plugin, PluginBlock, PluginPage, HorusSingleton, SlurmBlock

# Import the RemoteManager for the block's remote
from Server.RemotesManager import RemotesManager

# Import the settings manager
from Server.SettingsManager import SettingsManager

# User management for remote son blocks
from Server.WebAppManager import HorusUser

if typing.TYPE_CHECKING:
    # Cast the flask_login UserMixin to the HorusUser class
    currentUser = typing.cast(HorusUser, flask_login.current_user)
else:
    currentUser = flask_login.current_user


class DefaultPluginConfigException(Exception):
    """
    Exception raised when a default plugin stores configuration in the AppSupport directory.
    """


class PluginManager(metaclass=HorusSingleton):
    """
    This class manages the installation, loading and uninstallation of plugins.
    It creates the AppSupport/Plugins directory if it doesn't exist.
    """

    # Track if the plugins need to be reloaded
    pluginChanges = True

    # HorusSettings instance
    horusSettings: SettingsManager

    def __init__(
        self,
        appSupportDir: typing.Optional[str] = None,
    ):
        if appSupportDir is None:
            raise Exception("AppSupport directory not provided in PluginManager init call.")

        # Set the HorusSettings instance
        self.horusSettings = SettingsManager(appSupportDir)

        self.appSupportDir = appSupportDir

        # Get the plugins and dependencies directory
        self._pluginsDepsDir()

        # Save the current working dir
        self.workingDir = os.getcwd()

        # Initialize the plugins
        self._initializePlugins()

    def _pluginsDepsDir(self):
        """
        Creates the plugins and dependencies directory if they doesn't exist.
        - appSupportDir: The path to the AppSupport directory
        """

        # Defines the default plugins directory, which should be in the same
        # directory as the executable bundle
        try:
            bundleDir = sys._MEIPASS  # type: ignore
            self.defaultPluginsDir = os.path.abspath(os.path.join(bundleDir, "DefaultPlugins"))
        except AttributeError:
            # We are not in a bundle, use the AppSupport/DefaultPlugins directory
            self.defaultPluginsDir = os.path.join(self.appSupportDir, "DefaultPlugins")

        if not os.path.exists(self.defaultPluginsDir):
            os.makedirs(self.defaultPluginsDir, exist_ok=True)

        # Defines the plugins directory, which should be in the AppSupport directory
        self.pluginsDir = os.path.join(self.appSupportDir, "Plugins")
        if not os.path.exists(self.pluginsDir):
            os.makedirs(self.pluginsDir, exist_ok=True)

        # Defines the dependencies directory, which should
        # be in the AppSupport directory
        # self.depsDir = os.path.join(appSupportDir, "Dependencies")
        # if not os.path.exists(self.depsDir):
        #     os.mkdir(self.depsDir)

        # # Add the dependencies directory to the PYTHON path
        # sys.path.append(self.depsDir)

    def installPlugin(self, socketio: SocketIO, file: typing.Optional[str] = None):
        """
        Opens the file dialog to select a plugin file
        and installs it to the plugins folder.
        """
        from App import AppDelegate

        if file is None:
            try:
                files = AppDelegate().openFileSelectDialog(
                    allowMultiple=True, fileTypes=("Horus plugins (*.hp)",)
                )
            except Exception as exc:
                raise Exception(f"Failed to get plugin path: {exc}") from exc
        else:
            files = [file]

        if not files:
            return

        for f in files:  # pylint: disable=invalid-name
            with PrintSocketCapturer(socketio, "installPluginDep"):
                print("Installing plugin: " + f)
                self._installPlugin(f)

        self.reloadPlugins()

        socketio.emit("pluginChanges")

    def _installPlugin(self, path):
        # Get the name of the plugin
        pluginName = os.path.basename(path)

        # Remove the extension
        pluginName = os.path.splitext(pluginName)[0]

        # Create a folder with the same name as the plugin
        tmpInstallDir = os.path.join(self.pluginsDir, "tmpInstall")

        if os.path.exists(tmpInstallDir):
            print("Removing previous temporary folder...")

            # Remove any previous tmpInstall folder
            shutil.rmtree(tmpInstallDir)

            import time

            startTime = time.time()
            while os.path.exists(tmpInstallDir):
                if time.time() - startTime > 10:
                    raise Exception("Stuck deleting temporary folder. Try restarting the app.")

        os.mkdir(tmpInstallDir)

        print("Copying plugin to temporary folder...")

        newPlugin = shutil.copy(path, tmpInstallDir)

        # If the plugin is provided in .hp format, unzip it
        if newPlugin.endswith(".hp"):
            print("Unzipping plugin...")

            # Unzip the plugin
            import zipfile

            with zipfile.ZipFile(newPlugin, "r") as zipRef:
                zipRef.extractall(tmpInstallDir)

                logging.getLogger("Horus").info("Zip contents: %s", zipRef.namelist())

            # Remove the .hp file
            os.remove(newPlugin)

            # For installing a plugin, it is required that the plugin files
            # are located in the root of the extracted contents. If the plugin
            # was packed packing the container folder instead, we need to move
            # the files to the root of the extracted contents.

            # On macos, sometimes the zip files are extracted with a __MACOSX folder
            # which contains some metadata. If this is the case, ignore it
            if "__MACOSX" in os.listdir(tmpInstallDir):
                shutil.rmtree(os.path.join(tmpInstallDir, "__MACOSX"))

            # Get the contents of the extracted folder
            contents = os.listdir(tmpInstallDir)

            # If the resulting extraction is a single folder, move the files
            # to the root of the extracted contents
            isSingleFolder = len(contents) == 1 and os.path.isdir(
                os.path.join(tmpInstallDir, contents[0])
            )

            if isSingleFolder:
                print("Moving plugin files to the root of the extracted contents...")

                # Get the folder name
                folderName = contents[0]

                # Rename it to some hash in order to prevent clashes
                newFolderName = "tmp_" + str(hash(folderName))

                oldFolderPath = os.path.join(tmpInstallDir, folderName)
                newFolderPath = os.path.join(tmpInstallDir, newFolderName)

                # Rename the folder
                os.rename(
                    oldFolderPath,
                    newFolderPath,
                )

                # Get the files in the folder
                folderContents = os.listdir(newFolderPath)

                # Move the files to the root of the extracted contents
                for f in folderContents:
                    shutil.move(os.path.join(newFolderPath, f), tmpInstallDir)

                # Remove the folder
                print("Removing temporary plugin folder...")
                shutil.rmtree(newFolderPath)

        else:
            raise Exception("Invalid plugin format (.hp expected)")

        # Get the .py file
        # newPlugin = os.path.join(newPluginDir, pluginName + ".py")

        try:
            print("Checking plugin...")
            self._preInstallPlugin(tmpInstallDir)
            loadedPlugin = self._loadPlugin(tmpInstallDir, appendToLoaded=False)
            self._postInstallPlugin(tmpInstallDir)

            if loadedPlugin is None:
                raise Exception(
                    f"Error installing '{path}'. PluginLoader could not load the plugin."
                )

            # If everything went correct, move the plugin to its folder
            pluginFinalPath = os.path.join(self.pluginsDir, loadedPlugin.id)

            # If a plugin with the same name already exists, check if it is the same plugin
            # in order to upgrade it
            if not os.path.exists(pluginFinalPath) and not loadedPlugin in self.loadedPlugins:
                print("Saving new plugin to its folder...")
                shutil.move(tmpInstallDir, pluginFinalPath)
                print(
                    "Plugin installed."
                    + " You can start working with the blocks in the flow manager."
                    + " For extensions to work, a restart of Horus is needed."
                )
                self.loadedPlugins.append(loadedPlugin)
            else:
                # If we are installing the same plugin, upgrade it only if the version is higher
                newPluginVersion = loadedPlugin.info["version"]
                currentInstalledPluginVersion = self._getPluginByID(loadedPlugin.id).info[
                    "version"
                ]

                # Parse the version strings
                from packaging import version

                newPluginVersion = version.parse(newPluginVersion)
                currentInstalledPluginVersion = version.parse(currentInstalledPluginVersion)

                # Compare the versions
                newVersionIsHigher = newPluginVersion > currentInstalledPluginVersion

                if newVersionIsHigher:
                    print(f"Upgrading plugin {loadedPlugin.info['name']}...")

                    # Backup the plugin configuration to the new plugin folder
                    currentConfigPath = self._pluginConfigPath(
                        self._getPluginByID(loadedPlugin.id)
                    )
                    newConfigPath = self._pluginConfigPath(loadedPlugin)

                    # Read the current config if it exists, and update the new plugin config
                    if os.path.exists(currentConfigPath):
                        print("Backing up plugin configuration...")
                        with open(currentConfigPath, "r", encoding="utf-8") as f:
                            currentConfig = json.load(f)

                        # Update the new plugin config
                        loadedPlugin._saveConfig(newConfigPath, currentConfig)

                    # Remove the old plugin
                    self.loadedPlugins.remove(self._getPluginByID(loadedPlugin.id))

                    print("Deleting old plugin version...")
                    # Remove the old plugin folder
                    if os.path.exists(pluginFinalPath):
                        shutil.rmtree(pluginFinalPath)

                    # Wait for the folder to be deleted
                    while os.path.exists(pluginFinalPath):
                        pass

                    # Move the new plugin to the final path
                    shutil.move(tmpInstallDir, pluginFinalPath)

                    # Add the new plugin
                    self.loadedPlugins.append(loadedPlugin)

                    print("Plugin upgraded to version " + f"{loadedPlugin.info['version']}")

                    # Emit the plugin changes
                    self.reloadPlugins()
                else:
                    message = (
                        "You are trying to install "
                        + f"{loadedPlugin.info['name']} version "
                        + f"{loadedPlugin.info['version']}, but you already have version "
                        + f"{currentInstalledPluginVersion}."
                    )

                    if currentInstalledPluginVersion == newPluginVersion:
                        message += (
                            " If you are trying to reinstall the plugin, " + "uninstall it first."
                        )

                    if currentInstalledPluginVersion > newPluginVersion:
                        message += (
                            " Which means that you are trying to install an older version. "
                        )

                    logging.getLogger("Horus").error(message)

                    raise Exception(message)
        except Exception as e:
            if os.path.exists(tmpInstallDir):
                shutil.rmtree(tmpInstallDir)
            raise Exception(e) from e

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

        plugin = self._getPlugin(pluginName)

        # Remove the plugin folder
        pluginPath = os.path.join(self.pluginsDir, plugin._path)

        try:
            self._preRemovePlugin(pluginPath)
            shutil.rmtree(pluginPath)
            self._postRemovePlugin(pluginPath)
        except Exception as exc:
            raise Exception(f"{exc}. Try restarting the app") from exc

        self.reloadPlugins()

    def _listPluginsPaths(self):
        """
        Lists the plugins present in the plugins directory.
        """

        # List the directories present in the plugins directory
        installedPlugins = [
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

        plugins = defaultPlugins + installedPlugins

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

        logging.getLogger("Horus").info("Plugins initialized (%i).", len(self.loadedPlugins))
        logging.getLogger("Horus").info("Error plugins (%i).", len(self.errorPlugins))

        self.pluginChanges = False

    def _loadPlugin(
        self, pluginPath: str, appendToLoaded: bool = True
    ) -> typing.Optional[Plugin]:
        """
        Loads a plugin from the given path.

        :param pluginPath: The path to the plugin folder
        """

        if not os.path.isdir(pluginPath):
            raise Exception(f"Plugin {pluginPath} must be a directory.")

        try:
            plugin = self._checkPlugin(pluginPath)
            logging.getLogger("Horus").info("Loaded plugin %s", plugin.info["name"])
        except DefaultPluginConfigException:
            return None
        except Exception as e:
            import traceback

            logging.getLogger("Horus").error("Error loading plugin: %s", e)
            logging.getLogger("Horus").error("Traceback: %s", traceback.format_exc())
            raise e

        # Check that the plugin is not already loaded
        for p in self.loadedPlugins:
            if p == plugin:
                logging.getLogger("Horus").warning(
                    "Plugin %s already loaded. If you are upgrading the plugin, "
                    + "ignore this warning. Otherwise, uninstall it first.",
                    plugin.info["name"],
                )
                # raise Exception(
                #     f"Plugin {plugin.info['name']} already installed. "
                #     + "In order to update it, uninstall it first."
                # )

        # Create the config folder
        # configDir = os.path.join(pluginPath, "config")
        configDir = os.path.dirname(self._pluginConfigPath(plugin))

        # Create it only if the plugin needs configs
        if not os.path.exists(configDir):
            try:
                os.makedirs(configDir)
            # Except a read-only filesystem
            except OSError as ose:
                logging.getLogger("Horus").warning(
                    "Could not create config folder for plugin %s. "
                    + "The filesystem is read-only.",
                    plugin.info["name"],
                )

                raise Exception(
                    f"Could not create config folder for plugin {plugin.info['name']}. "
                    + "The filesystem is read-only."
                ) from ose

        # Add the plugin to the loaded plugins
        if appendToLoaded:
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
        logging.getLogger("Horus").debug("Loading plugin meta: %s", pluginMeta)

        if not os.path.exists(pluginMeta):
            # If the plugin.meta does not exist, but the plugin is in the default plugins
            # then we can assume that this folder is just the config folder of the plugin

            pluginID = os.path.basename(pluginDir)
            try:
                self._getPluginByID(pluginID)
            except Exception as e:
                raise Exception("The plugin does not contain a plugin.meta file.") from e

            raise DefaultPluginConfigException

        # Load the plugin.meta
        with open(pluginMeta, "r", encoding="utf-8") as f:
            try:
                pluginMeta = json.load(f)
            except Exception as e:
                raise Exception(f"Could not load plugin meta ({pluginMeta}): {e}") from e

        # Dependencies for the plugin
        depsDir = os.path.join(pluginDir, "deps")

        # Create the deps folder
        if not os.path.exists(depsDir):
            try:
                os.mkdir(depsDir)
            # Except a read-only filesystem
            except OSError:
                logging.getLogger("Horus").warning(
                    "Could not create dependencies folder for plugin %s. "
                    + "The filesystem is read-only.",
                    pluginMeta["name"],
                )

                # Set the deps dir to None
                depsDir = None

        # Get the entry point from meta
        entryPoint = pluginMeta.get("pluginFile", None)
        if entryPoint is None:
            raise Exception("The plugin does not contain a pluginFile entry.")

        pluginPath = os.path.join(pluginDir, entryPoint)

        # Load the plugin file and obtain the plugin variable
        spec = importlib.util.spec_from_file_location("pluginFile", pluginPath)
        if spec is None:
            raise Exception(f"Failed to create module spec for {entryPoint}")

        # Read and load the python file
        pluginModule = importlib.util.module_from_spec(spec)

        with PluginDeps(pluginDir):
            # Install dependencies if the deps dir exists
            if depsDir is not None:
                self._installDependencies(pluginMeta, depsDir)

            # Load the entry point
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

        # With the path set, load the metadata
        pluginModule.plugin.loadPluginMeta()

        # Check if the plugin is a default plugin
        if pluginPath.startswith(self.defaultPluginsDir):
            pluginModule.plugin.info["default"] = True  # type: ignore
        else:
            pluginModule.plugin.info["default"] = False  # type: ignore

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

            # If the dependency was downloaded from a git repo, the name
            # then is the url of the repo. Found inside direct_url.json
            directUrlPath = os.path.join(depsDir, idep, "direct_url.json")
            if os.path.exists(directUrlPath):
                with open(directUrlPath, "r", encoding="utf-8") as f:
                    directUrl = json.load(f)
                    name = directUrl.get("url", None)

                    # The file could be damaged, skip it and reinstall the dependency
                    if name is None:
                        continue

                    # If it was obtained by git, add +git to the url
                    vcsInfo = directUrl.get("vcs_info", {}).get("vcs", None)
                    if vcsInfo is not None:
                        name = vcsInfo + "+" + name
            else:
                # Otherwise, the name is the first part of the .dist folder
                name = idep.split("-")[0].lower()

            version = idep.split("-")[1].split(".dist")[0]

            # Lowercase the name
            name = name.lower()

            # Add the dependency to the installed dependencies
            installedDeps[name] = version

        # Iterate through the required dependencies
        for dep in dependencies:
            parsedDep = dep.replace(" --no-deps", "")
            name = parsedDep.split("==")[0].lower()
            version = parsedDep.split("==")[1] if "==" in dep else None

            # Condense the if statements to have better readability
            exists = installedDeps.get(name, None)
            doNotExist = exists is None
            hasToUpgrade = exists != version and version is not None
            hasToInstall = doNotExist or hasToUpgrade

            if hasToInstall:
                if doNotExist:
                    print(f"Installing dependency {parsedDep} for plugin {pluginName}...")
                elif hasToUpgrade:
                    print(f"Upgrading dependency {parsedDep} for plugin {pluginName}...")

                    # Remove the old dependency dist-info
                    for depDir in listedDeps:
                        if f"{name}-" in depDir:
                            logging.getLogger("Horus").info(
                                "Removing old dependency %s...", depDir
                            )
                            shutil.rmtree(os.path.join(depsDir, depDir))

                    # Remove the actual package
                    shutil.rmtree(os.path.join(depsDir, name))

                try:
                    self._installDepInternal(dep, depsDir)
                except Exception as e:
                    print(e)
                    raise e

    def _preInstallPlugin(self, pluginDir: str):
        preInstPath = os.path.join(pluginDir, "preinst.sh")
        if os.path.isfile(preInstPath):
            print("Executing pre-install script")
            try:
                callPopen(["sh", preInstPath], cwd=pluginDir)
            except Exception:
                raise Exception("Error running pre-install script")

    def _postInstallPlugin(self, pluginDir: str):
        postInstPath = os.path.join(str(pluginDir), "postinst.sh")
        if os.path.isfile(postInstPath):
            print("Executing post-install script")
            try:
                callPopen(["sh", postInstPath], cwd=pluginDir)
            except Exception:
                raise Exception("Error running post-install script")

    def _preRemovePlugin(self, pluginDir: str):
        preRMPath = os.path.join(str(pluginDir), "prerm.sh")
        if os.path.isfile(preRMPath):
            print("Executing pre-remove script")
            try:
                callPopen(["sh", preRMPath], cwd=pluginDir)
            except Exception:
                raise Exception("Error running pre-remove script")

    def _postRemovePlugin(self, pluginDir: str):
        postRMPath = os.path.join(str(pluginDir), "postrm.sh")
        if os.path.isfile(postRMPath):
            print("Executing post-remove script")
            try:
                callPopen(["sh", postRMPath], cwd=pluginDir)
            except Exception:
                raise Exception("Error running post-remove script")

    def _installDepInternal(self, dep: str, depsDir: str):
        """
        Installs a dependency for a plugin.

        :param dep: The dependency to install
        :param depsDir: The path to the dependencies folder
        """

        # Get the interpreter and python version from the user settings
        from App import AppDelegate

        # If we are on "App mode (i.e there is a GUI),
        # we will raise an exception to tell the user
        # that in order to install dependencies, the app
        # must be in "Server mode" or "Browser mode"
        # (i.e the user has an opened terminal window
        # where to visualize the pip output)
        # This is to prevent the app taking too long to
        # start without any feedback to the user
        if AppDelegate().desktop and not hasattr(AppDelegate(), "_server"):
            msg = (
                "A dependency installation was requested during the startup of the app. "
                + "In order to correctly install dependencies, please install the plugin"
                + " using the 'Install plugin' button in the 'Plugin Manager' window. \n"
                + "You can override this behaviour and install the dependencies at startup "
                + "by starting the app with the '--server' flag in the terminal."
            )

            logging.getLogger("Horus").error(msg)

            raise Exception(msg)

        # First check that the user has a valid
        # python interpreter when the app is frozen
        # Unfortunately, PyInstaller does not include
        # the python interpreter in the bundle, therefore
        # to install dependencies we need to use the system
        # python interpreter. If the user does not have a
        # valid python interpreter, we cannot install dependencies
        # and we need to raise an exception.
        interpreter: str = "python"
        try:
            interpreter = str(self.horusSettings.getSetting("dependenciesInterpreter").value)
        except Exception as e:
            msg = f"Could not get the python interpreter from the user settings: {e}"
            msg += "\nDefaulting to system python interpreter."
            print(msg)

        # Check if the python interpreter is valid
        try:
            p = subprocess.Popen(
                [interpreter, "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.PIPE,
            )
        except Exception as e:
            raise Exception(
                f"Could not execute '{interpreter}' command. {e}."
                + " Make sure you have selected a valid interpreter in the settings."
            ) from e

        # Wait for the process to finish
        p.wait()

        # Get the result
        if p.stdout is None:
            raise Exception("Could not get the intalled python interpreter version.")

        version = p.stdout.read().decode("utf-8").strip().split(" ")[-1]

        try:
            appPythonVersion = AppDelegate().APP_INFO["PYTHON_VERSION"]
        except Exception as exc:
            raise Exception(f"Could not get the python version from the app info: {exc}") from exc

        exceptionMsg = (
            "In order to install additional dependencies, "
            "you need to have a valid python interpreter "
            f"installed on your system with python v{appPythonVersion}. "
            "You can select a specific interpreter in the settings."
        )

        # Check the return code
        if p.returncode != 0 and p.returncode is not None:
            raise Exception(exceptionMsg)

        # Check that the major and minor version of python matches
        major = version.split(".")[0]
        minor = version.split(".")[1]

        appVersionMajor = appPythonVersion.split(".")[0]
        appVersionMinor = appPythonVersion.split(".")[1]

        majorMatches = major == appVersionMajor
        minorMatches = minor == appVersionMinor

        # Both major and minor versions must match (eg. 3.9.12 == 3.9.15)
        # Patch versions are ignored
        bothMatch = majorMatches and minorMatches

        if not bothMatch:
            exceptionMsg += f" (Currently detected python v{version})"
            raise Exception(exceptionMsg)

        # Get the PATH environment variable
        path = os.environ.get("PATH", None)

        # Check that the PATH environment variable exists, if not
        # some dependencies may not be installed correctly. For example, Biopython
        # requires the PATH environment variable to be set in order to build its wheel
        if path is None:
            logging.getLogger("Horus").error(
                "Could not get the PATH environment variable. "
                + "Some dependencies may not be installed correctly."
            )

        # Define the environment variables to correctly run the external python interpreter
        env = {
            "PYTHONPATH": depsDir,
            "PATH": path,
        }

        # Execute the pip command with the selected interpreter
        if "--no-deps" in dep:
            dep = dep.replace(" --no-deps", "")
            noDependencies = True
        else:
            noDependencies = False

        # The command to install dependencies with pip
        command = [
            interpreter,
            "-m",
            "pip",
            "install",
            dep,
            "--target",
            depsDir,
            "--upgrade",
            "--no-input",
            *(["--no-deps"] if noDependencies else []),
        ]

        try:
            callPopen(command, env=env)
        except Exception as exc:
            msg = f"Dependency {dep} could not be installed: {str(exc)}"
            print(msg)
            logging.getLogger("Horus").error(msg)
            raise Exception(msg)

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
            info["config"] = p._configToDict()  # pylint: disable=protected-access
            listedPlugins.append(info)
        for ep in self.errorPlugins:
            info = ep.info
            info["actions"] = str(len(ep.actions) if ep.actions else 0)
            info["views"] = str(len(ep.views))
            errorPlugins.append(info)
        return {"plugins": listedPlugins, "errors": errorPlugins}

    def _getBlocksFromList(self, plugin: Plugin, blockList: typing.List[PluginBlock]):
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

    def findBlock(self, fromBlockID: str):
        """
        Finds a block from a block ID or raises an exception if not found.
        """
        # Split the id
        pluginID = fromBlockID.split(".")[0]

        # Find the plugin
        try:
            plugin = self._getPluginByID(pluginID)
        except Exception as exc:
            raise Exception(f"PluginID {pluginID} not found") from exc

        # Get the block
        try:
            block = plugin.getBlock(fromBlockID)
        except Exception as exc:
            raise Exception(f"Block {fromBlockID} not found") from exc

        return block

    def executeBlock(
        self,
        block: PluginBlock,
        flowID: str,
        resetRemoteBlock: bool = False,
        isFirstSlurm: bool = True,
    ):
        """
        Executes a given block.
        Should be already prepared with the variables.
        Method specific for running the block through the Flow class.
        """

        logging.getLogger("Horus").info("Executing block %s", block.id)

        # Find the plugin
        plugin = self._getPluginByID(block.id.split(".")[0])

        # Read the config file for the block
        configPath = self._pluginConfigPath(plugin)

        if os.path.exists(configPath):
            # Set the plugin config to execute the block
            plugin._updateConfigs(configPath)  # pylint: disable=protected-access

            # Set the block config to execute the block
            block.config = plugin.config

        try:
            remoteManager = RemotesManager(currentUser.appSupportDir)
        except AttributeError:
            remoteManager = RemotesManager(self.appSupportDir)

        if block.selectedRemote != "Local":
            logging.getLogger("Horus").info("Connecting to remote %s", block.selectedRemote)

        # If the selected remote of the block does not exist, set it to Local
        if not remoteManager.remoteExists(block.selectedRemote):
            logging.getLogger("Horus").warning(
                "The selected remote '%s' for block '%s' does not exist. "
                + "Setting it to 'Local'",
                block.selectedRemote,
                block.name,
            )

            block.selectedRemote = "Local"

        remoteManager.connectRemote(block.selectedRemote)
        rAPI = remoteManager.remote

        if rAPI is None:
            raise Exception("No cluster selected.")  #  pylint: disable=broad-exception-raised

        rAPI._blockID = block.id  # pylint: disable=protected-access
        rAPI._blockPlacedID = block._placedID  # pylint: disable=protected-access
        rAPI._flowSavedID = flowID  # pylint: disable=protected-access
        rAPI._resetRemoteBlock = resetRemoteBlock  # pylint: disable=protected-access

        # Update the block with the remote configuration
        block._setRemote(rAPI)  # pylint: disable=protected-access

        # Set the block plugin path
        block.pluginDir = plugin._path

        # If its a slurm block, check if the job has finished
        if isinstance(block, SlurmBlock):
            # If we are unpausing a flow that sent a slurm calculation,
            # we need to skip the first execution of the block
            if block._status != block.Status.IDLE and isFirstSlurm:
                return

        # Execute the block
        error = False
        errorMSG = ""
        outputs = None

        # Calcultate the time the block takes
        startTime = datetime.datetime.now().timestamp()
        try:
            with PluginDeps(plugin._path):
                outputs = block()
                # Execute the block
                # outputs = PluginDeps.subprocessBlock(block)
        except Exception:  # pylint: disable=broad-exception-caught

            # Get the full traceback
            import traceback

            errorMSG = traceback.format_exc()
            error = True
        finally:
            # Calculate the final time
            finalTime = datetime.datetime.now().timestamp()

            # Calculate the total time
            totalTime = datetime.timedelta(seconds=finalTime - startTime).total_seconds()

            # Store the block time
            block.time += totalTime

            # Get formatted time in hh:mm:ss
            hours = int(totalTime // 3600)
            minutes = int((totalTime % 3600) // 60)
            seconds = int(totalTime % 60)

            formattedTime = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

            logging.getLogger("Horus").info("Block %s executed in %s", block.id, formattedTime)

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
            "pluginDir": p._path,
            "hidden": pg.hidden,
        }

    def _getDevelopmentPage(self):
        """
        If on development mode, returns the "Development" page
        """

        # Check for the "developmentExtensuonURL setting"
        # If we are on development mode, add the "Develop extension" page
        if self.horusSettings.getSetting("developmentMode").value:
            extensionURL: str = self.horusSettings.getSetting("extensionDevelopmentURL").value

            # Parse the URL if it does not have http://
            if not extensionURL.startswith("http://"):
                extensionURL = "http://" + extensionURL

            return {
                "id": "development",
                "plugin": "Horus",
                "name": "Development",
                "description": "Develop extensions directly from the development server.",
                "html": "No HTML",
                "url": extensionURL,
                "deps": "No deps",
                "pluginDir": "No plugin dir",
            }
        else:
            return None

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

        # Check for the development page
        developmentPage = self._getDevelopmentPage()

        if developmentPage is not None:
            pages.append(developmentPage)

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
        Initializes the config file for the plugins.
        """

        configPath = self._pluginConfigPath(plugin)

        # If the config file does not exist, create it
        if not os.path.exists(configPath):
            plugin._createConfig(configPath)
        else:
            # If the config file exists, read it
            plugin._updateConfigs(configPath)

    def _pluginConfigPath(self, plugin: Plugin):
        """
        Returns the path of the config file for a plugin.
        """

        # # Find the plugin folder
        # pluginID = block.id.split(".")[0]
        # plugin = self._getPluginByID(pluginID)

        configDir = os.path.join(plugin._path, "config")

        # If the config folder is inside a default plugin (read-only)
        # move it to the user's app support dir
        if plugin.info["default"]:
            configDir = os.path.join(self.pluginsDir, plugin.id, "config")

        # Find the block config file
        pluginConfigFile = os.path.join(configDir, f"{plugin.id}.json")

        return pluginConfigFile

    def saveConfig(self, config: typing.Dict[str, typing.Any]):
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
            # blockID = ".".join(configId.split(".")[:-2])
            # if "config" in blockID.split("."):
            # blockID = ".".join(blockID.split(".")[:-1])
            # block = plugin.getBlock(blockID)

            # Get the path of the config file
            configDir = self._pluginConfigPath(plugin)

            valuesToSave = {}
            for variable in config["variables"]:
                if variable["type"] == "group":
                    variableGroupValues = {}
                    for subVariable in variable["variables"]:
                        variableGroupValues[subVariable["id"]] = subVariable["value"]
                    valuesToSave[variable["id"]] = variableGroupValues
                else:
                    valuesToSave[variable["id"]] = variable["value"]

            # Save the config
            plugin._saveConfig(configDir, valuesToSave)

            # Execute the config block
            pluginConfigID = plugin.id + ".config." + configId.split(".")[-1]
            configBlock = plugin._getConfig(pluginConfigID)

            with io.StringIO() as buf, redirect_stdout(buf), redirect_stderr(buf):  # type: ignore
                # Execute the config block
                configBlock()

                # Get the output
                output += buf.getvalue()

        # Reload the plugins
        self.reloadPlugins()

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


class PrintCapturer(io.StringIO):
    """
    Captures any print statement.
    """

    oldStdout: typing.Any
    """
    The old stdout where to print the message besides the socketio event.
    """

    oldStderr: typing.Any
    """
    The old stderr where to print the message besides the socketio event.
    """

    def __init__(self):
        self.oldStdout = sys.stdout
        self.oldStderr = sys.stderr

        super().__init__()

    def write(self, message):
        """
        Writes the message to the terminal.
        """
        self.oldStdout.write(message)

    def flush(self):
        """
        Default implementation of flush.
        """
        self.oldStdout.flush()

    def __enter__(self):
        """
        Used to redirect the stdout and stderr to the PrintCapturer
        upon entering a with statement.
        """
        sys.stdout = self
        sys.stderr = self

    def __exit__(self, exc_type, exc_value, traceback):
        """
        Used to restore the stdout and stderr upon exiting a with statement.
        """
        sys.stdout = self.oldStdout
        sys.stderr = self.oldStderr


class PrintSocketCapturer(PrintCapturer):
    """
    Captures any print statement and sends it to the client besides printing it to the terminal.
    """

    socketio: SocketIO
    event: str
    room: typing.Optional[str]

    def __init__(
        self, socketio: SocketIO, event: str = "printTerm", room: typing.Optional[str] = None
    ):
        """
        Initializes the PrintSocketCapturer.

        :param socketio: The socketio instance.
        :param printTo: The name of the socketio event to print to (default: "printTerm")
        """
        super().__init__()
        self.socketio = socketio
        self.event = event
        self.room = room

    def write(self, message):
        """
        Writes the message to the socketio event and to the terminal.
        """
        self.socketio.emit(self.event, message, to=self.room)
        super().write(message)
        self.socketio.sleep(0)


class PluginDeps:
    """
    Enters a context where the dependencies of a plugin are added to the PYTHONPATH.
    """

    intialPath: str
    """
    The initial python path before entering the context.
    """

    intialModules: dict[str, ModuleType]
    """
    The initial modules before entering the context.
    """

    def __init__(self, pluginDir: str):
        self.initialPath = sys.path.copy()
        self.intialModules = sys.modules.copy()
        self.pluginDir = pluginDir

    def __enter__(self):
        self._includeDepsPath()

    def __exit__(
        self, exc_type, exc_value, traceback
    ):  # pylint: disable=unused-argument,invalid-name
        self._removeDepsPath()

    def _includeDepsPath(self):
        """
        Adds the deps folder of the plugin to the python path.
        """
        depsDir = os.path.join(self.pluginDir, "deps")
        includeDir = os.path.join(self.pluginDir, "Include")
        sys.path.insert(0, depsDir)
        sys.path.insert(0, includeDir)

        # Once pyinstaller is compiled, distributions inside the deps
        # directory are not correctly detected by pkg_resources.
        # To fix this, we need to add the deps directory to the
        # pkg_resources working set

        # Add the deps directory to the working set
        pkg_resources.working_set.add_entry(depsDir)

        # Add the include directory to the working set
        pkg_resources.working_set.add_entry(includeDir)

    def _removeDepsPath(self):
        """
        Removes the deps folder of the plugin from the python path.
        """
        depsDir = os.path.join(self.pluginDir, "deps")
        includeDir = os.path.join(self.pluginDir, "Include")

        # Remove them also from the sys.modules
        # WARNING: With the creation of subprocessBlock and subprocessCall,
        # this should not be necessary anymore. But we will leave just in case.
        for key, module in list(sys.modules.items()):

            # Check if its a new module, otherwise skip it because it is required by Horus
            if key in self.intialModules:
                continue

            # Get the module path
            modulePath = module.__file__ if hasattr(module, "__file__") else None

            # If the module is in the deps folder, remove it
            if modulePath is not None and (
                modulePath.startswith(includeDir) or modulePath.startswith(depsDir)
            ):
                if key in self.intialModules:
                    logging.getLogger("Horus").warning(
                        "Module %s used by plugin %s is in the App default modules. "
                        + "The App version was used instead of the Plugin version.",
                        key,
                        self.pluginDir,
                    )

            # Unload the module
            del sys.modules[key]

        # Restore the initial python path
        sys.path = self.initialPath

        # Remove the deps directory from the working set
        pkg_resources.working_set.entries.remove(depsDir)

        # Remove the include directory from the working set
        pkg_resources.working_set.entries.remove(includeDir)

    @classmethod
    def subprocessCall(cls, fn, *args, **kwargs):
        """
        Calls the given function in a subprocess and returns the result.

        Why? Because each plugin can import libraries from their dependencies. We want these
        libraries to be only loaded within the scope of the plugin's action
        (for example, an endpoint). This way, we can
        avoid conflicts between libraries of different plugins, and re-import the
        libraries each time we execute a plugin's action.
        """

        ctx = mp.context.ForkContext()
        q = ctx.Queue(1)
        error = ctx.Value("b", False)

        def target():
            try:
                q.put(fn(*args, **kwargs))
            except BaseException as e:
                error.value = True  # type: ignore
                q.put(e)

        ctx.Process(target=target).start()
        result = q.get()
        if error.value:  # type: ignore
            raise result

        return result

    @classmethod
    def subprocessBlock(cls, block: PluginBlock):
        """
        Calls the given block's action in a subprocess.
        Returns the result and the updated block.

        Why? Because each block can import libraries from their dependencies. We want these
        libraries to be only loaded within the scope of the block's action. This way, we can
        avoid conflicts between libraries of different blocks.
        """

        # Fork the current context to execute the block in a subprocess
        ctx = mp.context.ForkContext()

        # Setup a queue to communicate with the subprocess, only 1 element
        q = ctx.Queue(1)

        # Fork the block
        def target(forkedBlock: PluginBlock):
            # Block outputs
            outputs = None

            # Block error
            error = None

            # Try to execute the block
            try:
                outputs = forkedBlock()
            except BaseException as e:
                error = e

            q.put(
                {
                    "pendingActions": forkedBlock.flow.pendingActions,
                    "terminalOutput": forkedBlock.flow.terminalOutput,
                    "block": forkedBlock._minimalEncode(),
                    "outputs": outputs,
                    "error": error,
                }
            )

        ctx.Process(target=target, args=[block]).start()

        result = q.get()

        # Update the block to get the updated outputVariables, extraData...
        updatedBlock = result["block"]
        block._parseInternalVariables(updatedBlock)

        # Update the terminal output of the block
        block.flow.terminalOutput.clear()
        block.flow.terminalOutput.extend(result["terminalOutput"])

        # Update the pending actions of the block
        block.flow.pendingActions.clear()
        block.flow.pendingActions.extend(result["pendingActions"])

        # If there was an error, raise it
        if result["error"] is not None:
            raise result["error"]

        # If everything went well, return the outputs
        return result["outputs"]


def callPopen(command: list[str], cwd: str = ".", env: typing.Optional[dict] = None):
    """
    Calls subprocess.Popen with a context manager and prints the STDOUT and STDERR

    Raises an Exception if command fails

    Params
    ------
    - command: list[str]: a list of strings indicating the command and its arguments
    - cwd: str: The current working directory. Default = "."
    - env: dict: A dictionary containing environment variables for the command. Default = None
    """
    with subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        stdin=subprocess.DEVNULL,
        cwd=cwd,
        text=True,
        env=env,
    ) as p:
        # Print the output
        if p.stdout is None:
            raise Exception(f"Could not get the output of {command}.")

        for line in p.stdout:
            print(line, end="")

        # Wait for the process to finish
        p.wait()

        # Check the return code
        if p.returncode != 0 and p.returncode is not None:
            raise Exception(f"{command} failed")
