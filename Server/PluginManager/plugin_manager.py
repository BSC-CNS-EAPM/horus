"""
The PluginManager module contains the PluginManager class. This class
manages the installation, loading and uninstallation of plugins. Most
importantly, it manages the execution of the individual blocks of the plugins.
"""

# Standard imports
from collections import defaultdict, deque
from multiprocessing import Process
import os
import signal
import sys
import typing
import io
import subprocess
import logging
import json
import shutil
import datetime
from pydantic import BaseModel, ValidationError
from contextlib import contextmanager
import re
import time

# For downloading plugins
import requests

from packaging import version as version_module

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

from Server.RemotesManager import CommandFailed

# Plugin deps context manager, forking the process prevents
# importend modules from being imported twice
if typing.TYPE_CHECKING:
    import multiprocessing as mp
else:
    import multiprocess as mp

# More types from the HorusAPI
from HorusAPI import (
    Plugin,
    PluginBlock,
    PluginPage,
    HorusSingleton,
    SlurmBlock,
    PluginMetaModel,
    BlockNotFoundError,
    PlatformType,
    __version__ as HorusAPIVersion,
    Status,
)

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


class PluginNotFoundError(Exception):
    """
    Exception raised when a plugin is not found.
    """


class PluginMetaNotFound(Exception):
    """
    Exception raised when a plugin meta is not found.
    """


class PluginManager(metaclass=HorusSingleton):
    """
    This class manages the installation, loading and uninstallation of plugins.
    It creates the AppSupport/Plugins directory if it doesn't exist.
    """

    # Track if the plugins need to be reloaded
    pluginChanges = True

    # HorusSettings instance
    @property
    def horusSettings(self) -> SettingsManager:
        """
        Returns a global HorusSettings instance
        """
        return SettingsManager(self.appSupportDir)

    def __init__(
        self,
        appSupportDir: typing.Optional[str] = None,
    ):
        if appSupportDir is None:

            from App import AppDelegate

            self.appSupportDir = AppDelegate().appSupportDir

            # raise Exception("AppSupport directory not provided in PluginManager init call.")
        else:
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
            self.defaultPluginsDir = os.path.join(bundleDir, "DefaultPlugins")
        except AttributeError:
            # We are not in a bundle, use the AppSupport/DefaultPlugins directory
            self.defaultPluginsDir = os.path.join(self.appSupportDir, "DefaultPlugins")

        # If the environment varialbe HORUS_DEFAULT_PLUGINS_DIR is set, use that
        self.defaultPluginsDir = os.path.abspath(
            os.getenv("HORUS_DEFAULT_PLUGINS_DIR") or self.defaultPluginsDir
        )

        logging.getLogger("Horus").info("Default plugins directory: %s", self.defaultPluginsDir)

        if not os.path.exists(self.defaultPluginsDir):
            os.makedirs(self.defaultPluginsDir, exist_ok=True)

        # Defines the plugins directory, which should be in the AppSupport directory
        # If the environment varialbe HORUS_PLUGINS_DIR is set, use that
        self.pluginsDir = os.path.abspath(
            os.getenv("HORUS_PLUGINS_DIR") or os.path.join(self.appSupportDir, "Plugins")
        )

        logging.getLogger("Horus").info("Plugins directory: %s", self.pluginsDir)

        if not os.path.exists(self.pluginsDir):
            os.makedirs(self.pluginsDir, exist_ok=True)

        # Add the plugins dir to the pythonpath to access other plugins from plugins
        sys.path.append(self.defaultPluginsDir)
        sys.path.append(self.pluginsDir)

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

        with PrintSocketCapturer(socketio, "installPluginDep"):
            self._loopPluginsToInstall(files)

        self.reloadPlugins()

        socketio.emit("pluginChanges")

    def _loopPluginsToInstall(self, files: typing.Sequence[str], asDefault: bool = False):
        downloadDir = os.path.join(self.appSupportDir, "plugin_downloads")
        for f in files:  # pylint: disable=invalid-name
            try:
                # If the file is a plugin URL from the web, download it
                if f.startswith("https://") or f.startswith("http://"):
                    print("Downloading plugin from URL...")

                    os.makedirs(downloadDir, exist_ok=True)

                    f = self._downloadPluginFromURL(f, downloadDir)

                # If the file is a plugin from the plugin repo (starts with pluginID://)
                # then download the specific version
                # for this system
                if f.startswith("pluginID://"):
                    pluginID = f.split("://")[1]
                    os.makedirs(downloadDir, exist_ok=True)
                    f = self._downloadPluginFromRepo(pluginID, downloadDir)

                print("Installing plugin: " + f)
                self._installPlugin(f, asDefault)
            finally:
                if os.path.exists(downloadDir):
                    shutil.rmtree(downloadDir, ignore_errors=True)

    def _downloadPluginFromRepo(self, pluginID: str, downloadDir: str) -> str:
        """
        Downloads a plugin from the repo.

        Args:
            pluginID (str): The ID of the plugin to download.

        Returns:
            str: The path to the downloaded plugin.
        """

        from App import AppDelegate

        print(f"Downloading plugin {pluginID}...")

        # First get plugin info
        urlForInfo = f"https://horus.bsc.es/repo_api/plugins/{pluginID}"

        pluginResponse = requests.get(urlForInfo, timeout=30)

        if pluginResponse.status_code != 200:
            raise Exception(f"Failed to get plugin info: {pluginResponse.status_code}")

        jsonResponse = pluginResponse.json()

        # Get the latest compatible version
        compatibleVersion: typing.Optional[str] = None
        compatiblePlatform: typing.Optional[str] = None

        appPlatform = AppDelegate.getPlatform()

        print(f"Finding compatible version for '{appPlatform}' and Horus {HorusAPIVersion}...")

        found = False
        for v in jsonResponse["versions"]:

            if found:
                break

            version = jsonResponse["versions"][v]
            platforms = version["platforms"]
            for p in platforms:
                pluginPlatforms = p["platforms"]

                if "universal" not in pluginPlatforms and appPlatform not in pluginPlatforms:
                    continue

                if appPlatform in p["platforms"]:
                    compatiblePlatform = appPlatform
                    compatibleVersion = v
                    found = True
                    break

                compatibleVersion = v
                compatiblePlatform = "universal"
                found = True
                break

        if compatibleVersion is None or compatiblePlatform is None:
            raise Exception("Could not find compatible version.")

        print(f"Found compatible version: {compatibleVersion} ({compatiblePlatform})")

        # Download the plugin
        urlForPlugin = (
            f"https://horus.bsc.es/repo_api/download?"
            f"plugin_id={pluginID}&version={compatibleVersion}&platform={compatiblePlatform}"
        )

        return self._downloadPluginFromURL(urlForPlugin, downloadDir)

    def _downloadPluginFromURL(self, url: str, downloadDir: str) -> str:
        """
        Downloads a plugin from a URL.

        Args:
            url (str): The URL of the plugin to download.
            downloadDir (str): The directory to download the plugin to.

        Returns:
            str: The path to the downloaded plugin.
        """

        downloadPath = os.path.join(downloadDir, "plugin_download.hp")

        print(f"Downloading plugin from {url}...")

        with requests.get(url, stream=True, timeout=30) as pluginResponse:
            pluginResponse.raise_for_status()

            total = int(pluginResponse.headers.get("content-length", 1))

            progress = 0
            with open(downloadPath, "wb") as f:
                for chunk in pluginResponse.iter_content(chunk_size=8192):
                    progress += len(chunk)
                    roundedProgress = int(progress / total * 100)
                    print(f"{roundedProgress}%")
                    f.write(chunk)

        if pluginResponse.status_code != 200:
            raise Exception(f"Failed to download plugin: {pluginResponse.status_code}")

        print("Downloaded plugin to: " + downloadPath)

        return downloadPath

    def _installPlugin(self, path, asDefault: bool = False):
        # Get the name of the plugin
        pluginName = os.path.basename(path)

        # Remove the extension
        pluginName = os.path.splitext(pluginName)[0]

        # Create a folder with the same name as the plugin
        tmpInstallDir = os.path.join(self.pluginsDir, "tmpInstall")

        if os.path.exists(tmpInstallDir):
            print("Removing previous temporary folder...")

            # Remove any previous tmpInstall folder
            shutil.rmtree(tmpInstallDir, ignore_errors=True)

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
                shutil.rmtree(newFolderPath, ignore_errors=True)

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
            if asDefault:
                pluginFinalPath = os.path.join(self.defaultPluginsDir, loadedPlugin.id)
            else:
                pluginFinalPath = os.path.join(self.pluginsDir, loadedPlugin.id)

            # Remove the old plugin folder
            if os.path.exists(pluginFinalPath):
                print("Deleting old plugin version...")
                shutil.rmtree(pluginFinalPath, ignore_errors=True)

                # Wait for the folder to be deleted
                while os.path.exists(pluginFinalPath):
                    time.sleep(1)

            # If a plugin with the same name already exists, check if it is the same plugin
            # in order to upgrade it
            if not loadedPlugin in self.loadedPlugins:
                print("Saving new plugin to its folder...")
                os.rename(tmpInstallDir, pluginFinalPath)
                print(
                    "Plugin installed."
                    + " You can start working with the blocks in the flow manager."
                    + " For extensions to work, a restart of Horus is needed."
                )
                self.loadedPlugins.append(loadedPlugin)
            else:

                print(f"Upgrading plugin {loadedPlugin.pluginMeta.name}...")

                # Remove the old plugin
                try:
                    self.loadedPlugins.remove(self._getPluginByID(loadedPlugin.id))
                except (ValueError, PluginNotFoundError):
                    pass

                # Move the new plugin to the final path
                os.rename(tmpInstallDir, pluginFinalPath)

                # Add the new plugin
                self.loadedPlugins.append(loadedPlugin)

                print("Plugin upgraded to version " + f"{loadedPlugin.pluginMeta.version}.")

        finally:
            if os.path.exists(tmpInstallDir):
                shutil.rmtree(tmpInstallDir, ignore_errors=True)

    def _getPluginByID(self, id: str) -> Plugin:
        """
        Returns a plugin with the given name.
        """
        for p in self.loadedPlugins:
            if p.id == id:
                return p

        # Search in the error plugins
        for p in self.errorPlugins:
            if p.id == id:
                return p
        raise PluginNotFoundError(f"PluginID '{id}' not found.")

    def uninstallPlugin(self, pluginID: str):
        """
        Uninstalls a plugin with the given ID.
        """

        try:
            plugin = self._getPluginByID(pluginID)
            pluginPath = os.path.join(self.pluginsDir, plugin._path)
        except PluginNotFoundError:
            pluginPath = os.path.join(self.pluginsDir, pluginID)

        if not os.path.exists(pluginPath):
            return

        # Remove the plugin folder
        try:
            self._preRemovePlugin(pluginPath)
            self._postRemovePlugin(pluginPath)

            # Delete the config and the plugin
            shutil.rmtree(os.path.join(self.appSupportDir, "config", plugin.id))
            shutil.rmtree(pluginPath, ignore_errors=True)

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

        for pth in self._getPluginsImportOrder(pluginPaths):
            try:
                self._loadPlugin(pth)
            except Exception as e:

                dummyMeta = {
                    "id": os.path.basename(pth).lower(),
                    "name": os.path.basename(pth),
                    "description": str(e),
                    "author": "unknown",
                    "version": "unknown",
                    "pluginFile": os.path.basename(pth),
                    "platforms": None,
                }

                # Define an error dummy plugin
                errorPlugin = Plugin(noMetaLoad=True)
                errorPlugin.pluginMeta = PluginMetaModel(**dummyMeta)
                errorPlugin.id = dummyMeta["id"]
                errorPlugin._path = pth
                self.errorPlugins.append(errorPlugin)

                # No need to log here as it is already logged in _loadPlugin
                # logging.getLogger("Horus").error("Error loading plugin '%s': %s", pth, str(e))

        logging.getLogger("Horus").info(
            "%i plugins initialized: %s.",
            len(self.loadedPlugins),
            ", ".join([plugin.id for plugin in self.loadedPlugins]),
        )

        if len(self.errorPlugins) > 0:
            logging.getLogger("Horus").error(
                "%i plugins with errors: %s.",
                len(self.errorPlugins),
                ", ".join([plugin.id for plugin in self.errorPlugins]),
            )

        self.pluginChanges = False

    def _getPluginsImportOrder(self, pluginPaths: list[str]) -> list[str]:
        """
        Based on each plugin's pluginRequires metadata,
        set the correct order for import order
        """

        class MetaPath(BaseModel):
            meta: PluginMetaModel
            p: str

        # Get the metadata for all plugins
        metas: list[MetaPath] = []
        errors: list[str] = []
        for p in pluginPaths:
            try:
                m = MetaPath(**{"meta": self._loadPluginMeta(p), "p": p})
                if m:
                    metas.append(m)
            except Exception:
                errors.append(p)

        # Build a graph based on plugin dependencies
        graph = defaultdict(list)
        in_degree = {meta.meta.id: 0 for meta in metas}

        for meta in metas:
            for dep in meta.meta.pluginRequires or []:
                graph[dep].append(meta.meta.id)
                in_degree[meta.meta.id] += 1

        # Collect plugins with no dependencies
        queue = deque([meta for meta in metas if in_degree[meta.meta.id] == 0])
        sorted_plugins: list[str] = []

        while queue:
            current = queue.popleft()
            sorted_plugins.append(current.p)

            for dependent in graph[current.meta.id]:
                in_degree[dependent] -= 1
                if in_degree[dependent] == 0:
                    queue.append(next(m for m in metas if m.meta.id == dependent))

        if len(sorted_plugins) != len(metas):

            repeated = ""
            # Get the wrong values
            for p in sorted_plugins:
                c = sorted_plugins.count(p)
                if c > 1:
                    repeated += f"{p} was required {c} times. "

            raise ValueError(
                "Circular dependency detected among plugins. If you are the developer of such plugins, please update the plugin.meta file accordingly."
                f" Errors were found for the following plugins: {repeated}"
            )

        # Add the error plugins
        sorted_plugins = errors + sorted_plugins

        return sorted_plugins

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

            if not plugin:
                return None

            logging.getLogger("Horus").info(
                "Loaded plugin '%s' with ID '%s'", plugin.pluginMeta.name, plugin.id
            )
        except DefaultPluginConfigException:
            return None
        except Exception as e:
            logging.getLogger("Horus").error("Error loading plugin '%s'. %s", pluginPath, str(e))
            raise e

        # Check that the plugin is not already loaded
        for p in self.loadedPlugins:
            if p == plugin:
                logging.getLogger("Horus").warning(
                    "Plugin %s already loaded. If you are upgrading the plugin, "
                    + "ignore this warning. Otherwise, uninstall it first.",
                    plugin.pluginMeta.name,
                )

        # Add the plugin to the loaded plugins
        if appendToLoaded:
            try:
                self._getPluginByID(plugin.id)
                error = (
                    f"Plugin with ID '{plugin.id}' already exists. Plugins must have unique IDs."
                )
                raise ValueError(error)
            except PluginNotFoundError:
                self.loadedPlugins.append(plugin)

        # Return the plugin in case its needed
        return plugin

    def _loadPluginMeta(self, pluginDir: str) -> typing.Union[PluginMetaModel, None]:
        """
        Loads the PluginMeta from the given path
        """

        pluginMetaPath = os.path.join(pluginDir, "plugin.meta")

        if not os.path.exists(pluginMetaPath):
            # If the plugin.meta does not exist, but the plugin is in the default plugins
            # then we can assume that this folder is just the config folder of the plugin

            return None

            # pluginID = os.path.basename(pluginDir)
            # try:
            #     self._getPluginByID(pluginID)
            # except PluginNotFoundError as e:
            #     # A exception is raised here if the plugin is not loaded
            #     # That means that there is a folder in the Plugins directory that does
            #     # not correspond with any plugin configuration nor loaded plugin.
            #     # Because the directory also does not  contain a plugin.meta file
            #     # it will get ignored.
            #     raise PluginMetaNotFound("The plugin does not contain a plugin.meta file.") from e

            # raise DefaultPluginConfigException

        # Load the plugin.meta
        with open(pluginMetaPath, "r", encoding="utf-8") as f:
            try:
                pluginMeta = json.load(f)
            except Exception as e:
                raise Exception(f"Could not load plugin meta ({pluginMetaPath}): {e}") from e

        # Check that the plugin.meta is valid with the schema
        try:
            pluginMetaModel = PluginMetaModel(**pluginMeta)

            self.assertPluginValidForThisPlatform(
                pluginMetaModel.minHorusVersion,
                pluginMetaModel.maxHorusVersion,
                pluginMetaModel.platforms,
            )

            return pluginMetaModel

        except ValidationError as e:
            for error in e.errors():
                field = error["loc"][0]
                msg = f"Field '{field}': {error['msg']}."
            raise ValueError(f"Validation error in plugin meta '{pluginMetaPath}'. {msg}") from e
        except Exception as e:
            raise ValueError(f"Invalid plugin meta '{pluginMetaPath}'. {e}") from e

    def _checkPlugin(self, pluginDir) -> typing.Union[Plugin, None]:
        """
        Checks if a plugin is valid.

        :param pluginPath: The path to the plugin folder
        """

        # Load the plugin.meta
        logging.getLogger("Horus").debug("Loading plugin meta at: %s", pluginDir)
        pluginMetaModel = self._loadPluginMeta(pluginDir)

        if not pluginMetaModel:
            return None

        pluginMeta = pluginMetaModel.dict()

        # Dependencies for the plugin, there they will be installed
        # inside a /lib/pythonX.X/site-packages folder
        # (view the getFullPluginDepsDir function)
        depsDir = PluginDepsBase.getFullPluginDepsDir(pluginDir)

        # Create the deps folder
        if not os.path.exists(depsDir):
            try:
                os.makedirs(depsDir, exist_ok=True)
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
            raise ValueError("The plugin does not contain a pluginFile entry.")

        pluginID = pluginMeta.get("id", None)
        if pluginID is None:
            raise ValueError("The plugin does not contain an id entry.")

        pluginPath = os.path.join(pluginDir, entryPoint)

        if pluginMetaModel.id in (pluginMetaModel.pluginRequires or []):
            raise ValueError(
                f"The plugin requires itself. Remove the {pluginMetaModel.id} from the plugin.meta file."
            )

        requirementsPaths = []
        for p in pluginMetaModel.pluginRequires or []:
            try:
                requirementsPaths.append(self._getPluginByID(p)._path)
            except PluginNotFoundError:
                raise ValueError(
                    f"Could not find plugin '{p}', which is required by '{pluginID}'."
                )

        with PluginDepsBase([pluginDir] + requirementsPaths):

            # Install dependencies if the deps dir exists
            if depsDir is not None and pluginMeta.get("dependencies", None):
                self._installDependencies(pluginMeta, pluginDir)

            orDir = os.getcwd()
            try:
                pluginDirPath = os.path.dirname(pluginPath)
                os.chdir(pluginDirPath)
                return SubprocessManager.subprocessCall(
                    self._internalLoadPluginInModule, pluginPath, entryPoint
                )
            finally:
                # Change the directory back
                os.chdir(orDir)

    def assertPluginValidForThisPlatform(
        self,
        minHorusVersion: typing.Optional[str],
        maxHorusVersion: typing.Optional[str],
        platforms: typing.Optional[PlatformType],
    ):
        """
        Verifies that the plugin is compatible with the current platform.
        """
        # Get the Horus version, and parse correctly development versions
        parsedHorusVersion = re.match(r"(\d+(?:\.\d+){0,2})", HorusAPIVersion)
        parsedHorusVersion = (
            parsedHorusVersion.group(1) if parsedHorusVersion else HorusAPIVersion
        )

        # Parse the Horus version
        horusVersion = version_module.parse(parsedHorusVersion)

        # Validate the Horus version with the "minHorusVersion" and "maxHorusVersion"
        if minHorusVersion:
            minHorusVersionParsed = version_module.parse(minHorusVersion)
            if minHorusVersionParsed > horusVersion:
                raise Exception(
                    "This plugin requires at least Horus version " f"{minHorusVersion}"
                )

        if maxHorusVersion:
            maxHorusVersionParsed = version_module.parse(maxHorusVersion)

            if horusVersion > maxHorusVersionParsed:
                raise Exception(f"This plugin requires at most Horus version {maxHorusVersion}")

        # Validate the platform, for linux just "linux" is enough
        # For macos, we have to check "macos_intel" and "macos_arm"
        if platforms and not "universal" in platforms:
            from App import AppDelegate

            currentPlatform = AppDelegate.getPlatform()

            if not currentPlatform in platforms:
                raise Exception(
                    "This plugin requires one of the following platforms: "
                    f"{platforms}. Current platform: {currentPlatform}"
                )

    def _internalLoadPluginInModule(self, pluginPath: str, entryPoint: str) -> Plugin:
        """
        WARNING: This function MUST run in the subprocessCall of
        PluginDeps in order to not mess the imported modules between plugins
        """

        try:
            # Load the plugin file and obtain the plugin variable
            spec = importlib.util.spec_from_file_location("pluginFile", pluginPath)
            if spec is None:
                raise Exception(f"Failed to create module spec for {entryPoint}")

            # Read and load the python file
            pluginModule = importlib.util.module_from_spec(spec)

            # Load the entry point
            spec.loader.exec_module(pluginModule)  # type: ignore
        except BaseException as e:
            import traceback

            # Extract the last exception from the traceback
            lastException = traceback.format_exception(None, e, e.__traceback__)
            filteredExc = []
            allow = False
            for ex in lastException:

                if allow:
                    filteredExc.append(ex)

                if "<frozen importlib._bootstrap>" in ex:
                    allow = True

            logging.getLogger("Horus").error("".join(filteredExc))

            raise e

        # Check that the plugin variable exists
        if not hasattr(pluginModule, "plugin"):
            raise Exception("The plugin has not declared a plugin variable.")

        # Check that the plugin variable is a Plugin instance
        if not isinstance(pluginModule.plugin, Plugin):
            raise Exception("The plugin does not contain a valid plugin instance.")

        # Check that the plugin variable has a name
        if not pluginModule.plugin.pluginMeta.name:
            raise Exception("The plugin does not have a valid name.")

        # Check if the plugin is a default plugin
        if pluginPath.startswith(self.defaultPluginsDir):
            pluginModule.plugin.default = True
        else:
            pluginModule.plugin.default = False

        # Return the loaded plugin instace
        return pluginModule.plugin

    def _installDependencies(self, pluginMeta: typing.Dict[str, str], pluginPath: str):
        """
        Installs the dependencies of a plugin.

        :param plugin: The plugin meta info
        :param pluginPath: The path to the plugin folder
        """

        dependencies = pluginMeta.get("dependencies", [])
        pluginName = pluginMeta.get("name", "Unknown")
        fullDepsDir = PluginDepsBase.getFullPluginDepsDir(pluginPath)

        # Create a new working set that includes the custom directory
        pluginWorkingSet = pkg_resources.WorkingSet(entries=[fullDepsDir])

        # Get the installed dependencies
        installedDeps = {pkg.key: pkg.version for pkg in pluginWorkingSet}

        # Check for dependencies installed from git repositories
        listedDeps = os.listdir(fullDepsDir)
        for idep in listedDeps:
            if ".dist-info" not in idep:
                continue

            # Check for direct_url.json to identify git-based installations
            directUrlPath = os.path.join(fullDepsDir, idep, "direct_url.json")
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

                    # Add the git dependency to the installed dependencies
                    installedDeps[name.lower()] = directUrl.get("vcs_info", {}).get(
                        "commit_id", "unknown"
                    )

        def versionSatisfies(
            installedVer: version_module.Version, specs: typing.Tuple[str, str]
        ) -> bool:
            op = specs[0]
            ver = specs[1]
            specVersion = version_module.parse(ver)
            if op == "==":
                if installedVer != specVersion:
                    return False
            elif op == ">=":
                if installedVer < specVersion:
                    return False
            elif op == "<=":
                if installedVer > specVersion:
                    return False
            elif op == ">":
                if installedVer <= specVersion:
                    return False
            elif op == "<":
                if installedVer >= specVersion:
                    return False
            return True

        # Iterate through the required dependencies
        depsToInstallStringList = []
        currentString = None
        for dep in dependencies:
            parsedDep = dep.replace(" --no-deps", "").replace(" --isolated", "")
            versionSpecs = None
            if not parsedDep.startswith("git+"):
                try:
                    requirement = pkg_resources.Requirement.parse(parsedDep)
                    name = requirement.project_name.lower()
                    versionSpecs = requirement.specs
                except pkg_resources.RequirementParseError:
                    logging.getLogger("Horus").error(
                        "Invalid requirement specification: %s", parsedDep
                    )
                    continue

            # Check if the dependency is installed and if the version matches
            if name in installedDeps:
                installedVersion = version_module.parse(installedDeps[name])
                if versionSpecs and not versionSatisfies(installedVersion, versionSpecs[0]):
                    print(
                        f"Dependency '{name}' will be upgraded from version '{installedVersion}' "
                        f"to '{''.join(versionSpecs[0])}' for plugin '{pluginName}'..."
                    )
                else:
                    continue

            if "--no-deps" in dep or "--isolated" in dep:
                if currentString:
                    depsToInstallStringList.append(currentString)
                    currentString = None
                cleanDep = dep.replace(" --isolated", "") if "--isolated" in dep else dep
                depsToInstallStringList.append(cleanDep)
            else:
                if currentString:
                    currentString += " " + dep
                else:
                    currentString = dep

        if currentString:
            depsToInstallStringList.append(currentString)

        # Install or upgrade the dependency
        for stringDep in depsToInstallStringList:
            print(f"Installing '{stringDep}' for plugin {pluginName}...")
            self._installDepInternal(stringDep, pluginPath)

    def _preInstallPlugin(self, pluginDir: str):
        preInstPath = os.path.join(pluginDir, "preinst.sh")
        if os.path.isfile(preInstPath):
            print("Executing pre-install script")
            try:
                SubprocessManager.callPopen(["sh", preInstPath], cwd=pluginDir)
            except Exception as e:
                raise Exception("Error running pre-install script") from e

    def _postInstallPlugin(self, pluginDir: str):
        postInstPath = os.path.join(str(pluginDir), "postinst.sh")
        if os.path.isfile(postInstPath):
            print("Executing post-install script")
            try:
                SubprocessManager.callPopen(["sh", postInstPath], cwd=pluginDir)
            except Exception as e:
                raise Exception("Error running post-install script") from e

    def _preRemovePlugin(self, pluginDir: str):
        preRMPath = os.path.join(str(pluginDir), "prerm.sh")
        if os.path.isfile(preRMPath):
            print("Executing pre-remove script")
            try:
                SubprocessManager.callPopen(["sh", preRMPath], cwd=pluginDir)
            except Exception as e:
                raise Exception("Error running pre-remove script") from e

    def _postRemovePlugin(self, pluginDir: str):
        postRMPath = os.path.join(str(pluginDir), "postrm.sh")
        if os.path.isfile(postRMPath):
            print("Executing post-remove script")
            try:
                SubprocessManager.callPopen(["sh", postRMPath], cwd=pluginDir)
            except Exception as e:
                raise Exception("Error running post-remove script") from e

    def _installDepInternal(self, dep: str, pluginPath: str):
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
            raise Exception(msg)

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
            "PYTHONPATH": PluginDepsBase.getFullPluginDepsDir(pluginPath),
            "PATH": path,
        }

        # Execute the pip command with the selected interpreter
        if "--no-deps" in dep:
            dep = dep.replace(" --no-deps", "")
            noDependencies = True
        else:
            noDependencies = False

        interpreter = (
            [os.path.join(AppDelegate().bundleDir, "pip", "pip")]
            if AppDelegate().isCompiled
            else ["python", "-m", "pip"]
        )

        # The command to install dependencies with pip
        command = [
            "install",
            *dep.split(" "),
            "--prefix",
            PluginDepsBase.getFullPluginDepsDir(pluginPath, full=False),
            "--upgrade",
            "--no-input",
            "--ignore-installed",
            *(["--no-deps"] if noDependencies else []),
        ]

        try:
            # Here the embedded pip will be "python" in uncompiled mode! Remember...
            SubprocessManager.callPopen([*interpreter, *command], env=env)
        except Exception as exc:

            logging.getLogger("Horus").error(
                f"Dependency {dep} could not be installed using embedded pip: {str(exc)}"
            )

            try:
                # Some python packages need to be built from source, and the bundled pip cannot handle this.
                # For such cases, Horus will use the python interpreter set in the settings.
                interpreter = [self._getExternalInterpreter(), "-m", "pip"]
                logging.getLogger("Horus").error(
                    f"Trying with external python interpreter '{' '.join(interpreter)}'."
                )
                SubprocessManager.callPopen([*interpreter, *command], env=env)
            except Exception as exc2:
                msg = (
                    f"Failed to install dependency {dep}. External interpreter error: {str(exc2)}"
                )
                raise Exception(msg)

    def _getExternalInterpreter(self) -> str:
        """
        This method checks and verifies the defined interpreter set in the settings.
        """

        from App import AppDelegate

        interpreter: str = "python"
        try:
            interpreter = str(
                self.horusSettings.getSetting("dependenciesInterpreter").value
            ).strip()
        except Exception as e:
            msg = f"Could not get the python interpreter from the user settings: {e}. "
            msg += "Defaulting to path 'python' interpreter."
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

        return interpreter

    def getPlugins(self) -> dict:
        """
        Returns a list of all the loaded plugins (blocks + configs).
        """
        self._initializePlugins()
        listedPlugins = []
        errorPlugins = []

        # Get the remote list for listing the configurations
        # THIS INDICATES THAT PER-REMOTE-CONFIGURATION OF PLUGINS
        # IS NOT AVAILABLE ON WEBAPP MODE
        remoteList = RemotesManager(self.appSupportDir).listRemotes(includeLocal=True)

        for p in self.loadedPlugins:
            try:
                info = p.pluginMeta.dict()
                info["id"] = p.id
                info["blocks"] = self._getBlocksFromList(p, p.blocks)
                info["default"] = p.default
                info["logo"] = p.logo
                info["config"] = []
                # Config per remotes
                if len(p._configs) > 0:
                    for remote in remoteList:
                        p._updateConfigs(self._pluginConfigPath(p, remote["name"]))
                        info["config"].append(
                            {
                                "remote": remote["name"],
                                "config": p._configToDict(),  # pylint: disable=protected-access
                            }
                        )
                listedPlugins.append(info)
            except Exception as exc:
                logging.getLogger("Horus").error(
                    f"Could not get a plugin: {str(exc)}",
                )

        for ep in self.errorPlugins:
            info = ep.pluginMeta.dict()
            info["id"] = ep.id
            info["blocks"] = []
            info["default"] = ep.default
            info["logo"] = ep.logo
            info["config"] = []
            errorPlugins.append(info)

        return {"plugins": listedPlugins, "errors": errorPlugins}

    def _getBlocksFromList(self, plugin: Plugin, blockList: typing.List[PluginBlock]):

        def sortByName(block: PluginBlock):
            return block.name

        # Sort the blocks
        blockList.sort(key=sortByName)

        newBlocks: list[dict[str, typing.Any]] = []
        for b in blockList:
            newBlock = b._toDict()
            newBlock["plugin"] = {"name": plugin.pluginMeta.name, "id": plugin.id}
            newBlocks.append(newBlock)

        return newBlocks

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
        Finds a block from a 'plugin.block' ID format or raises an exception if not found.
        """
        # Split the id
        pluginID = fromBlockID.split(".")[0]

        # Find the plugin
        try:
            plugin = self._getPluginByID(pluginID)

            return plugin.getBlock(fromBlockID)

        except Exception as exc:
            raise BlockNotFoundError(fromBlockID) from exc

    def executeBlock(
        self,
        block: PluginBlock,
        flowID: str,
        resetRemoteBlock: bool = False,
        isFirstSlurm: bool = True,
        developmentMode: bool = False,
    ):
        """
        Executes a given block.
        Should be already prepared with the variables.
        Method specific for running the block through the Flow class.
        """

        # Clean the block logs, except if its second slurm
        if isFirstSlurm:
            block.blockLogs = ""

        logging.getLogger("Horus").info("Executing block %s", block.id)

        # Find the plugin
        plugin = self._getPluginByID(block.id.split(".")[0])

        # Read the config file for the block and the selected remote
        try:
            configPath = self._pluginConfigPath(plugin, block.selectedRemote)

            # Set the plugin config to execute the block
            plugin._updateConfigs(configPath)  # pylint: disable=protected-access

        except Exception as exc:
            logging.getLogger("Horus").error(
                "Could not read config file for block %s. %s", block.id, str(exc)
            )

        # Set the block config to execute the block
        block.config = plugin.config

        # Print debug info
        # If the user has development mode activated, print useful information about the block
        if developmentMode:
            print("============================ Development mode ==============================")
            print(f"Block starting time: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"Block ID: {block.id}")
            print(f"Block name: {block.name}")
            print(f"Block selected remote: {block.selectedRemote}")
            print(f"Block config:")
            print(json.dumps(block.config, indent=4))
            print(f"Block inputs:")
            print(json.dumps(block.inputs, indent=4))
            print(f"Block variables:")
            print(json.dumps(block.variables, indent=4))
            print(f"Block initial extraData:")
            print(json.dumps(block.extraData, indent=4))
            print(
                "============================================================================\n"
            )

        appSupportDir = self.appSupportDir
        if hasattr(currentUser, "appSupportDir"):
            appSupportDir = currentUser.appSupportDir

        # Set the block plugin path
        block.pluginDir = plugin._path

        # If its a slurm block, check if the job has finished
        if isinstance(block, SlurmBlock):

            # In order to check the slurm status, we need to connect to the remote here
            # This will also work as a firewall in order to cach connection errors, and pause the flow instead of
            # stopping it
            block._setRemote(RemotesManager(appSupportDir).getRemoteAPI(block.selectedRemote))

            # If we are unpausing a flow that sent a slurm calculation,
            # we need to skip the first execution of the block
            if block.status != Status.IDLE and isFirstSlurm:
                return

        # Execute the block
        error = False
        errorMSG = ""
        outputs = None

        # Set the working directory with a context manager
        @contextmanager
        def chdir(path):
            """Context manager for changing the current working directory."""
            currDir = os.getcwd()  # Save the current directory
            try:
                os.chdir(path)  # Change to the desired directory
                yield  # Yield control back to the block inside the context manager
            finally:
                os.chdir(currDir)  # Restore the original directory when done

        flowDir = block.flow.flowWorkDir(block.flow.path if block.flow.path else ".")

        # Calcultate the time the block takes
        startTime = datetime.datetime.now().timestamp()
        exception: typing.Union[None, Exception] = None
        try:
            with PluginDepsPlugin(plugin):
                with chdir(flowDir):
                    # Paramiko does not work on subprocess! Need to update to connect inside the block subprocess instead
                    outputs = SubprocessManager.subprocessBlock(
                        block, appSupportDir, resetRemoteBlock
                    )
        except Exception as e:
            if hasattr(e, "message"):
                exception = type(e)(e.message + errorMSG)  # type: ignore
            else:
                exception = e

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

            if developmentMode:
                print(
                    "\n============================ Development mode =============================="
                )
                print(f"Block execution time: {formattedTime}")
                print(f"Block error: {error}")
                print(f"Block outputs:")
                print(json.dumps(outputs, indent=4))
                print(f"Block final extraData:")
                print(json.dumps(block.extraData, indent=4))
                print(
                    "============================================================================="
                )

        if exception:
            raise exception

        # Return the output of the block
        return outputs

    def _getPageInfo(self, pg: PluginPage, p: Plugin):
        pg._pageInfo = {
            **pg._toDict(),
            "plugin": p.pluginMeta.name,
            "pluginID": p.id,
            "html": f"{p._path}/Pages/{pg.html}",
            "url": f"/plugins/pages/{pg.id}",
            "deps": PluginDepsBase.getFullPluginDepsDir(p._path),
            "pluginDir": p._path,
            "logo": p.logo,
        }
        return pg._pageInfo

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

    def getPagesObject(self) -> list[PluginPage]:
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

    # def _initConfig(self, plugin: Plugin, remote: str):
    #     """
    #     Initializes the config file for the plugins.
    #     """

    #     configPath = self._pluginConfigPath(plugin)

    #     # If the config file does not exist, create it
    #     if not os.path.exists(configPath):
    #         plugin._createConfig(configPath)
    #     else:
    #         # If the config file exists, read it
    #         plugin._updateConfigs(configPath)

    def _pluginConfigPath(self, plugin: Plugin, remote: str):
        """
        Returns the path of the config file for a plugin given its specific remote.
        """

        # # Find the plugin folder
        # pluginID = block.id.split(".")[0]
        # plugin = self._getPluginByID(pluginID)

        configDir = os.path.join(self.appSupportDir, "config", plugin.id)

        # Create it only if the plugin needs configs
        if not os.path.exists(configDir):
            try:
                os.makedirs(configDir)
            # Except a read-only filesystem
            except OSError as ose:
                error = f"Could not create config folder for plugin {plugin.pluginMeta.name}. "
                error += "The filesystem is read-only."
                logging.getLogger("Horus").warning(error)

                raise Exception(error) from ose

        # Find the block config file
        pluginConfigFile = os.path.join(configDir, f"{plugin.id}_{remote}.json")

        # Create the path if it does not exist
        if not os.path.exists(pluginConfigFile):
            os.makedirs(os.path.dirname(pluginConfigFile), exist_ok=True)

        return pluginConfigFile

    def saveConfig(self, newConfig: list, remote: str):
        """
        Saves the config to the config file specific for the remote.
        """

        # Loop through the newConfig array
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
            configDir = self._pluginConfigPath(plugin, remote)

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
        # NOT NECESSARY ANYMORE BECAUSE CONFIGURATION GETS LOADED WHEN THE BLOCK
        # RUNS PER-REMOTE
        # self.reloadPlugins()

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


class PluginDepsBase:
    """
    Enters a context where the dependencies of a plugin are added to the PYTHONPATH.
    """

    intialPath: str
    """
    The initial python path before entering the context.
    """

    paths: list[str]
    """
    Extra paths to be added from the other plugins requirements
    """

    intialModules: dict[str, ModuleType]
    """
    The initial modules before entering the context.
    """

    def __init__(self, paths: list[str]):
        """
        Will add the specified plugin folder to the python path including:

        - The Include folder
        - The deps folder
        - Recursively, the same for the pluginRequires
        """

        self.paths = paths

        self.initialPath = sys.path.copy()
        self.intialModules = sys.modules.copy()

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

        def addPath(path: str):
            depsDir = PluginDepsBase.getFullPluginDepsDir(path)
            includeDir = os.path.join(path, "Include")
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

        for p in self.paths:
            addPath(p)

    def _removeDepsPath(self):
        """
        Removes the deps folder of the plugin from the python path.
        """

        def removePath(path: str):
            depsDir = PluginDepsBase.getFullPluginDepsDir(path)
            includeDir = os.path.join(path, "Include")

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
                            path,
                        )

                # Unload the module
                del sys.modules[key]

            # Restore the initial python path
            sys.path = self.initialPath

            # Remove the deps directory from the working set
            pkg_resources.working_set.entries.remove(depsDir)

            # Remove the include directory from the working set
            pkg_resources.working_set.entries.remove(includeDir)

        for p in self.paths:
            removePath(p)

    @staticmethod
    def getFullPluginDepsDir(pluginPath: str, full=True) -> str:
        """
        Returns the true path to the dependencies directory for a given
        plugin for appending to PYTHONPATH.

        Args:
            pluginPath (str): The path to the plugin directory.

        Returns:
            str: The path to the dependencies directory.

        The dependencies directory is located at {pluginPath}/deps/lib/{pythonVersion}/site-packages,
        where {pythonVersion} is the first three characters of the Python version.

        This function creates the dependencies directory if it does not already exist.

        Example:
            >>> getPluginDepsDir("/path/to/plugin")
            "/path/to/plugin/deps/lib/python3.9/site-packages"
        """
        # We need to return a path of the form {pluginPath}/lib/python{pythonVersion}/site-packages
        depsDir = os.path.join(pluginPath, "deps")

        if not full:
            return depsDir

        # Get the python version
        pythonVersion = sys.version[:3]

        # Return the path
        return os.path.join(depsDir, "lib", "python" + str(pythonVersion), "site-packages")


class PluginDepsPlugin(PluginDepsBase):
    """
    Pass a plugin instance to the deps
    """

    def __init__(self, plugin: Plugin):

        # Get the paths from the plugin + the pluginRequirements

        paths = [plugin._path]

        pManager = PluginManager()
        for r in plugin.pluginMeta.pluginRequires or []:
            try:
                requirement = pManager._getPluginByID(r)
                paths.append(requirement._path)
            except PluginNotFoundError:
                pass

        super().__init__(paths)


class SubprocessManager:

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

        ctx = mp.context.ForkContext()  # type: ignore
        q = ctx.Queue(1)
        error = ctx.Value("b", False)

        def target():
            try:
                q.put(fn(*args, **kwargs))
            except BaseException as e:
                error.value = True  # type: ignore
                q.put(e)

        process = ctx.Process(target=target)
        process.daemon = False
        process.start()
        result = q.get()
        if error.value:  # type: ignore
            raise result

        return result

    @classmethod
    def subprocessBlock(cls, block: PluginBlock, appSupportDir: str, resetRemote: bool):
        """
        Calls the given block's action in a subprocess.
        Returns the result and the updated block.

        The remote connection is established within the subprocess to ensure Paramiko
        works correctly. This avoids issues with Paramiko's requirement to run in the
        same process where the connection was established.
        """

        # In this function we should cast mp to the regular Multirpcoess
        # (the developers of the libraries have messed up typing)

        # Fork the current context to execute the block in a subprocess
        ctx = mp.context.ForkContext()  # type: ignore
        # Setup a queue to communicate with the subprocess, only 1 element
        q = ctx.Queue(1)

        # Fork the block
        def target(forkedBlock: PluginBlock):

            # For stopping the flow on SIGTERM
            from Server.FlowManager import StoppedFlowException

            # Block outputs
            outputs = None

            # Block error
            error = None

            try:

                def handleStoppedFlow():
                    raise StoppedFlowException

                # Signal catcher for sigterm
                signal.signal(signal.SIGTERM, lambda s, f: handleStoppedFlow())

                # Establish remote connection inside the subprocess
                remoteManager = RemotesManager(appSupportDir)

                # If the selected remote doesn't exist, set it to Local
                if not remoteManager.remoteExists(forkedBlock.selectedRemote):
                    logging.getLogger("Horus").warning(
                        "The selected remote '%s' for block '%s' does not exist. "
                        + "Setting it to 'Local'",
                        forkedBlock.selectedRemote,
                        forkedBlock.name,
                    )
                    forkedBlock.selectedRemote = "Local"

                if forkedBlock.selectedRemote != "Local":
                    msg = f"Connecting to remote '{forkedBlock.selectedRemote}'..."
                    print(msg)
                    logging.getLogger("Horus").info(msg)

                rAPI = remoteManager.getRemoteAPI(forkedBlock.selectedRemote)

                if forkedBlock.selectedRemote != "Local":
                    msg = f"Successfully connected to remote '{forkedBlock.selectedRemote}'"
                    print(msg)
                    logging.getLogger("Horus").info(msg)

                # Update the block with the remote configuration
                forkedBlock._setRemote(rAPI)

                # Actually execute the block
                outputs = forkedBlock()

            except StoppedFlowException as sf:
                error = sf

            except BaseException as e:

                msg = str(e)

                from App import AppDelegate

                if (
                    AppDelegate().debug
                    or AppDelegate().server.settingsManager.getSetting("developmentMode").value
                    == True
                ):

                    import traceback

                    msg = f"{traceback.format_exc()}\n{e}"

                # Here we need to convert the exception because it may be a class which does not exist
                # outside of the forked context
                error = Exception(msg)

            finally:
                # Always ensure we put the result in the queue
                q.put(
                    {
                        "pendingActions": forkedBlock.flow.pendingActions,
                        "pendingSmilesActions": forkedBlock.flow.pendingSmilesActions,
                        "pendingExtensions": forkedBlock.flow.pendingExtensions,
                        "extraData": forkedBlock.flow.extraData,
                        "terminalOutput": forkedBlock.flow.terminalOutput,
                        "block": forkedBlock._minimalEncode(),
                        "outputs": outputs,
                        "error": error,
                    }
                )

        # Start the subprocess
        proc: Process = ctx.Process(target=target, args=[block])
        proc.start()

        def terminate():
            # The internal process is the one which will handle the SIGTERM
            proc.join()

        # Forward sigterm to child process
        signal.signal(signal.SIGTERM, lambda s, f: terminate())

        # Get the result from the subprocess
        result = q.get()

        # Update the block to get the updated outputVariables, extraData...
        updatedBlock = result["block"]
        block._parseInternalVariables(updatedBlock)

        # Update the flow attributes
        block.flow.terminalOutput.clear()
        block.flow.terminalOutput.extend(result["terminalOutput"])

        block.flow.pendingActions.clear()
        block.flow.pendingActions.extend(result["pendingActions"])

        block.flow.pendingSmilesActions.clear()
        block.flow.pendingSmilesActions.extend(result["pendingSmilesActions"])

        block.flow.pendingExtensions.clear()
        block.flow.pendingExtensions.extend(result["pendingExtensions"])

        block.flow.extraData = result["extraData"]

        # If there was an error, raise it
        if result["error"] is not None:
            raise result["error"]

        # If everything went well, return the outputs
        return result["outputs"]

    @staticmethod
    def callPopen(
        command: list[str],
        cwd: str = ".",
        env: typing.Optional[dict] = None,
        wait: bool = True,
        comunicate: bool = True,
    ) -> "SubprocessManager.HorusPopen":
        """
        Calls subprocess.Popen with a context manager and prints the STDOUT and STDERR

        Raises an Exception if command fails

        Params
        ------
        - command: list[str]: a list of strings indicating the command and its arguments
        - cwd: str: The current working directory. Default = "."
        - env: dict: A dictionary containing environment variables for the command. Default = None
        """

        logging.getLogger("Horus").debug("Calling Popen with command: %s", " ".join(command))

        p = SubprocessManager.HorusPopen(
            command,
            stdout=subprocess.PIPE if comunicate else subprocess.DEVNULL,
            stderr=subprocess.STDOUT if comunicate else subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            cwd=cwd,
            env=env,
            text=True if comunicate else None,
            preexec_fn=os.setsid,
        )

        if wait:

            # Print the output
            if p.stdout is None:
                raise Exception(f"Could not get the output of {command}.")

            for line in p.stdout:
                print(line, end="")

            # Wait for the process to finish
            p.wait()

            # Check the return code
            if p.returncode != 0 and p.returncode is not None:
                raise CommandFailed(
                    f"Command failed. Exit code: {p.returncode}",
                    cmd=" ".join(command),
                    stderr=str(p.stdout),
                    stdout=str(p.stdout),
                )

            return p
        else:
            return p

    class HorusPopen(subprocess.Popen):

        def is_alive(self):
            """
            Whether the process is alive or not
            """
            return self.poll() is not None

        def join(self, timeout: typing.Union[int, None] = None):
            """
            Mimics the multiprocess join functionality
            """

            self.wait(timeout=timeout)
