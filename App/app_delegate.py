import sys
import os
import webview

# Executing blocks
import threading
import subprocess
from flask_socketio import SocketIO

# Import type annotations
import typing

from Server import HorusServer
from Server import RemotesAPI

import cython
import json
import uuid
import datetime

from threading import Lock


# Define the SingletonMeta class for the AppDelegate and MolstarAPI classes
class SingletonMeta(type):
    """
    This is a thread-safe implementation of Singleton.

    Intened for internal use only.
    """

    _instances = {}

    _lock: Lock = Lock()
    """
    We now have a lock object that will be used to synchronize threads during
    first access to the Singleton.
    """
    _lock_event = threading.Event()

    def __call__(cls, *args, **kwargs):
        """
        Possible changes to the value of the `__init__` argument do not affect
        the returned instance.
        """
        # Now, imagine that the program has just been launched. Since there's no
        # Singleton instance yet, multiple threads can simultaneously pass the
        # previous conditional and reach this point almost at the same time. The
        # first of them will acquire lock and will proceed further, while the
        # rest will wait here.
        lock_acquired = cls._lock.acquire(timeout=1)  # Wait for the lock for 1 second
        if not lock_acquired:
            cls._lock_event.set()  # Notify the waiting threads
            raise TimeoutError("Trying to access unitialized Singleton instance")
        try:
            # The first thread to acquire the lock, reaches this conditional,
            # goes inside and creates the Singleton instance. Once it leaves the
            # lock block, a thread that might have been waiting for the lock
            # release may then enter this section. But since the Singleton field
            # is already initialized, the thread won't create a new object.
            if cls not in cls._instances:
                instance = super().__call__(*args, **kwargs)
                cls._instances[cls] = instance
        finally:
            cls._lock.release()
            cls._lock_event.set()  # Notify the waiting threads that lock is released

        return cls._instances[cls]


# Add to the pythonpath the path of the project
sys.path.append("../")


class WindowOptions:
    """
    Options for webview windows
    """

    width: int = 800
    """
    The initial width of the window
    """

    height: int = 600
    """
    The initial height of the window
    """

    resizable: bool = True
    """
    Whether the window is resizable
    """

    fullscreen: bool = False
    """
    Whether the window is fullscreen by default
    """

    min_size: typing.Tuple[int, int] = (200, 100)
    """
    The minimum size of the window
    """

    hidden: bool = False
    """
    Whether the window is hidden by default
    """

    frameless: bool = False
    """
    Whether the window is frameless
    """

    minimized: bool = False
    """
    Whether the window is minimized by default
    """

    on_top: bool = False
    """
    Whether the window is always on top
    """

    confirm_close: bool = False
    """
    Whether the user is asked to confirm closing the window
    """

    background_color: str = "#FFFFFF"
    """
    The background color of the window
    """

    text_select: bool = True
    """
    Whether text can be selected inside the window
    """

    transparent: bool = False
    """
    Whether the window is transparent
    """

    zoomable: bool = True
    """
    Whether the window can be zoomed
    """


# Define a overwrite exception for the saveFlow method
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


class AppDelegate(metaclass=SingletonMeta):
    @property
    def windows(self):
        """
        All of the windows that are currently open
        """

        openedWindows: typing.List[webview.Window] = webview.windows

        return openedWindows

    remote: RemotesAPI = None
    """
    The remote API
    """

    APP_INFO = {}
    """
    Stores relevant information about the app, such as

    - name: The name of the app
    - version: The version of the app
    - bundleIdentifier: The bundle identifier of the app
    """

    def __init__(
        self,
        debug: bool = False,
        server_mode: bool = False,
        browser: bool = False,
        debugURL: typing.Optional[str] = None,
    ):
        """
        Initialize the AppDelegate.
        This will start the backend server and create the first window.
        """
        self.debug = debug
        self.server_mode = server_mode
        self.browser = browser
        self.debugURL = debugURL

        # Load the app info from the APP_INFO file
        self._loadAppInfo()

        # Set the app support directory
        self._appSupportDir()

        # Load the settings
        self.appSettings = HorusSettings(self.appSupportDir)

        # Prepare the server
        self.server: HorusServer = HorusServer(
            debug=self.debug, desktop=not server_mode, appSupportDir=self.appSupportDir
        )

    def _loadAppInfo(self):
        """
        Loads the app info from the APP_INFO file.
        """

        # Get the path to the APP_INFO file
        try:
            sys._MEIPASS  # type: ignore
            envPath = os.path.join(sys._MEIPASS, "APP_INFO")
        except AttributeError:
            envPath = os.path.join("App", "APP_INFO")

        # Load the app info from the APP_INFO file
        with open(envPath, "r") as f:
            lines = f.readlines()

        appInfo = {}
        # Parse the lines
        for line in lines:
            # Skip empty lines
            if line.strip() == "":
                continue

            # Skip comments
            if line.strip().startswith("#"):
                continue

            # Split the line
            key, value = line.split("=")

            # Strip the key and value
            key = key.strip()
            value = value.strip()

            # Set the value
            appInfo[key] = value

        self.APP_INFO = appInfo

    def _appSupportDir(self):
        # If we are, use the default system Application Support directory
        # On macOS this is ~/Library/Application Support
        # On Windows this is %APPDATA%
        # On Linux this is ~/.local/share
        self.platform = sys.platform

        try:
            # Check if we are in a frozen executable
            sys._MEIPASS  # type: ignore

            if self.platform == "darwin":
                appSupportDir = os.path.join(
                    os.path.expanduser("~"),
                    "Library",
                    "Application Support",
                    self.APP_INFO["BUNDLE_IDENTIFIER"],
                )
            elif self.platform == "win32":
                appSupportDir = os.getenv("APPDATA")
                if appSupportDir is not None:
                    appSupportDir = os.path.join(
                        appSupportDir, self.APP_INFO["BUNDLE_IDENTIFIER"]
                    )
                else:
                    raise Exception("APPDATA environment variable not set")
            elif self.platform == "linux":
                appSupportDir = os.path.join(
                    os.path.expanduser("~"),
                    ".local",
                    "share",
                    self.APP_INFO["BUNDLE_IDENTIFIER"],
                )
            else:
                raise Exception(f"Unsupported platform {self.platform}")

        except AttributeError:
            # If we are not in a frozen executable,
            # place the Application Support directory in the project directory
            # (Development)
            appSupportDir = os.path.join("AppSupport")

        appSupportDir = os.path.abspath(appSupportDir)

        if not os.path.exists(appSupportDir):
            os.mkdir(appSupportDir)

        self.appSupportDir = appSupportDir

    def _startServerThread(self):
        """
        Starts the backend Flask server.
        This server will handle python modules and scripts in our app.
        """

        self.server_thread = threading.Thread(target=self.server.run)
        self.server_thread.daemon = True
        self.server_thread.start()

    def openWindow(
        self,
        title: str,
        url: typing.Optional[str] = None,
        wo: WindowOptions = WindowOptions(),
        forceNew: bool = False,
    ):
        """
        Creates a new window with the given title.
        If no url is given, the index page will be loaded.

        :param title: The title of the window
        :param url: The url to load
        :param wo: The window options (class WindowOptions)
        :param forceNew: Whether to force the creation of a new window if
        one with the same name already exists
        """

        # If no url is given, load the index page
        if url is None:
            url = self.server.baseURL

        # Check that the window is not already open
        if not forceNew:
            for window in self.windows:
                if window.title == title:
                    # Focus the window
                    window.show()
                    window.restore()
                    return

        # Tokenize the url
        url = self.tokenize(url)

        # Create a new window with the given options
        window = webview.create_window(
            title,
            url=url,
            width=wo.width,
            height=wo.height,
            resizable=wo.resizable,
            fullscreen=wo.fullscreen,
            min_size=wo.min_size,
            hidden=wo.hidden,
            frameless=wo.frameless,
            minimized=wo.minimized,
            on_top=wo.on_top,
            confirm_close=wo.confirm_close,
            background_color=wo.background_color,
            text_select=wo.text_select,
            transparent=wo.transparent,
            zoomable=wo.zoomable,
        )

        # Add the window to the list of windows
        # self.windows.append(window) # Not neccessary using the webview module

    def applicationDidFinishLaunching(self):
        """
        This will be called when the app is launched.
        It will create the first window and launch the app
        """

        if self.browser:
            # Start browser mode
            self._startBrowserMode()
        elif self.server_mode:
            # Start server mode
            self._startServerMode()
        else:
            # Start app mode
            self._startAppMode()

    def applicationWillTerminate(self):
        """
        This will be called after the last window is closed.
        """
        pass

    def _menus(self):
        import webview.menu as wm

        def newHorus():
            self.openWindow("Horus", forceNew=True)

        def openPlugins():
            pluginsURL = self.server.baseURL + "/plugins/"
            pluginsURL = self.tokenize(pluginsURL)
            self.openWindow("Plugins", url=pluginsURL)

        def aboutHorus():
            aboutURL = self.server.baseURL + "/about"
            aboutURL = self.tokenize(aboutURL)
            self.openWindow("About Horus", url=aboutURL)

        fileMenu = wm.Menu(
            "File",
            [
                # wm.MenuAction("New...", None),
                # wm.MenuAction("Open...", None),
                # wm.MenuAction("Save project...", None),
                # wm.MenuSeparator(),
                wm.MenuAction(
                    "New Window",
                    newHorus,
                ),
                wm.MenuAction(
                    "About Horus",
                    aboutHorus,
                ),
            ],
        )

        pluginsMenu = wm.Menu(
            "Plugins",
            [
                wm.MenuAction(
                    "Manage...",
                    openPlugins,
                )
            ],
        )

        def openRemotes():
            self.openWindow("Remotes", url=self.server.baseURL + "/remotes")

        settingsMenu = wm.Menu(
            "Settings",
            [
                wm.MenuAction("Remotes", openRemotes),
            ],
        )

        return [fileMenu, pluginsMenu, settingsMenu]

    def _startAppMode(self):
        """
        This will start the window and set the shemsu token to the window object.
        """

        # Start the server in a new thread
        self._startServerThread()

        # Wait for the server to start
        import requests

        while True:
            try:
                requests.get(self.server.baseURL)
                break
            except requests.exceptions.ConnectionError:
                pass

        # Get the GUI backend
        gui = "cocoa" if self.platform == "darwin" else "gtk"

        homeURL = self.server.baseURL

        wo = WindowOptions()
        if self.browser:
            homeURL += "/bmode"
            wo.width = 300
            wo.height = 250
            wo.confirm_close = True
            wo.resizable = False
            wo.on_top = True
        else:
            wo.width = 1200
            wo.height = 800

        if self.debugURL is not None:
            homeURL = f"{self.server.baseURL}/{self.debugURL}"

        homeURL = self.tokenize(homeURL)

        # Open the first window
        self.openWindow("Horus", url=homeURL, wo=wo)

        # Start the webview
        webview.start(debug=self.debug, menu=self._menus(), gui=gui)

    def _startServerMode(self):
        """
        Starts the app in server mode. Initializes the server.
        """

        # Start the server
        self.server.run(reloader=self.debug)

    def _startBrowserMode(self):
        """
        Starts the app in browser mode.
        Initializes the server and opens a browser window.
        """

        print(f"Opening browser to Horus at: {self.server.baseURL}")

        # Start the app
        self._startAppMode()

    def openBrowserMode(self):
        """
        Opens a browser window to the server link.
        """

        import webbrowser

        url = self.tokenize(self.server.baseURL)

        # Opens a browser window to the server link
        webbrowser.open(url)

    def openFileSelectDialog(
        self,
        allowMultiple: bool = False,
        fileTypes: typing.Tuple[str, ...] = ("All Files (*.*)",),
    ) -> typing.Tuple[str, ...]:
        """
        Opens a file dialog and returns the path of the selected file(s).

        :param allowMultiple: Allow the user to select multiple files
        :param fileTypes: A tuple of strings of file types to filter the files.
        The tuple must be in the format:
        ("Description (*.ext1;*.ext2...)", "Description 2 (*.ext3;*.ext4...)")
        """

        # Get the active window
        window = webview.windows[0]

        # Open the file dialog
        result: typing.Tuple[str, ...] = window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=allowMultiple, file_types=fileTypes
        )

        return result

    def openFolderSelectDialog(self) -> typing.Optional[str]:
        """
        Opens a folder dialog and returns the path of the selected folder.
        """
        # Get the active window
        window = webview.windows[0]

        # Open the folder dialog
        result: typing.Tuple[str, ...] = window.create_file_dialog(
            webview.FOLDER_DIALOG, allow_multiple=False
        )

        if isinstance(result, tuple):
            result = "".join(result)

        return result

    def saveFileSelectDialog(
        self,
        fileName: typing.Optional[str] = None,
        fileTypes: typing.Optional[typing.Tuple[str, ...]] = None,
    ) -> typing.Optional[str]:
        """
        Opens a save file dialog and returns the path of the selected file.

        :param fileName: The default file name
        :param fileTypes: A tuple of strings of file types to filter the files.
        The tuple must be in the format:
        ("Description (*.ext1;*.ext2...)", "Description 2 (*.ext3;*.ext4...)")
        """

        if fileTypes is None:
            fileTypes = ("All files (*.*)",)

        # Get the active window
        window = webview.windows[0]

        # Open the folder dialog
        result = window.create_file_dialog(
            webview.SAVE_DIALOG,
            allow_multiple=False,
            save_filename=fileName,
            file_types=fileTypes,
        )

        if result is None:
            return None

        # On Linux, the result is a tuple
        if isinstance(result, tuple):
            result = "".join(result)

        # On compiled macOS, the result is a pyobjc_unicode object
        if self.platform == "darwin":
            result = str(result)

        return result

    @staticmethod
    def tokenize(url: str):
        """
        Adds to an url the shemsu as a query parameter.
        """
        return f"{url}?shemsu={webview.token}"

    def configureRemote(self, newConfig: dict):
        """
        Configures the SSH connection for HPC clusters

        param newConfig: An object containing the ssh configuration
        {
            name: str,
            username: str,
            host: str,
            port: int,
            keys: str,
            proxyCommand: str,
        }
        """

        # Check that the config is valid
        if newConfig.get("name") is None:
            raise Exception("The name of the remote is required")

        if newConfig.get("username") is None:
            raise Exception("The user of the remote is required")

        if newConfig.get("host") is None:
            raise Exception("The host of the remote is required")

        if newConfig.get("port") is None:
            raise Exception("The port of the remote is required")

        if newConfig.get("keys") is None and newConfig.get("password") is None:
            raise Exception("Either the keys or the password of the remote is required")

        if newConfig.get("keys") is not None and newConfig.get("password") is not None:
            raise Exception("Either the keys or the password of the remote is required")

        if newConfig.get("keys") is not None and not os.path.exists(newConfig["keys"]):
            raise Exception("The keys file does not exist")

        if newConfig["name"].lower() == "local":
            # The local remote does not need to be configured
            raise Exception("The local machine does not need to be configured")

        remotesPath = os.path.join(self.appSupportDir, "remotes.json")

        if os.path.exists(remotesPath):
            # Load and update the existing ssh configuration
            with open(remotesPath, "r") as f:
                remotesConfig: typing.Dict[str, str] = json.load(f)

            # Check if the remote already exists
            if newConfig["name"] in remotesConfig.keys():
                # Update the remote
                remotesConfig[newConfig["name"]] = newConfig
            else:
                # Create a new remote
                remotesConfig.update({newConfig["name"]: newConfig})

        else:
            # Create a new ssh configuration
            remotesConfig = {newConfig["name"]: newConfig}

        with open(remotesPath, "w") as f:
            json.dump(remotesConfig, f)

    def listRemotes(self):
        """
        Loads the ssh configuration file and returns the list of remotes
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        if not os.path.exists(remotesFile):
            return []

        with open(remotesFile, "r") as f:
            remotesConfig: typing.Dict[str:str] = json.load(f)

        # Convert the remotes configuration to a list
        remotes = []
        for name, config in remotesConfig.items():
            remotes.append(config)

        return remotes

    def deleteRemote(self, name: str):
        """
        Removes a remote from the ssh configuration file

        :param name: The name of the remote to remove
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        if not os.path.exists(remotesFile):
            return

        with open(remotesFile, "r") as f:
            remotesConfig: typing.Dict[str:str] = json.load(f)

        # Remove the remote
        remotesConfig.pop(name)

        with open(remotesFile, "w") as f:
            json.dump(remotesConfig, f)

    def connectRemote(self, name: str):
        """
        Connects to a remote machine

        :param name: The name of the remote to connect
        """

        remotesFile = os.path.join(self.appSupportDir, "remotes.json")

        remotesConfig: typing.Dict[str:str] = {}
        if os.path.exists(remotesFile):
            with open(remotesFile, "r") as f:
                remotesConfig = json.load(f)

        # Check if the remote exists
        if name not in remotesConfig.keys() and name.lower() != "local":
            raise Exception(f"The remote {name} does not exist")

        if name.lower() == "local":
            self.remote = RemotesAPI(None, local=True)
        else:
            # Get the remote configuration if its not the local machine
            selectedRemote = remotesConfig[name]

            # Init the Remote
            self.remote = RemotesAPI(selectedRemote)

            # Connect to the remote
            self.remote.connect()

        if not self.remote.isConnected:
            raise Exception("Could not connect to the remote")

    def openAppSupportDir(self):
        """
        Opens the Application Support directory
        """
        self.openFileExplorer(self.appSupportDir)

    def openFileExplorer(self, path: str):
        """
        Opens a file explorer window with the given path.
        On macOS it will open Finder.
        On Windows it will open Explorer.
        On Linux it will open the default file explorer.

        :param path: The path to open
        """
        import subprocess

        if self.platform == "darwin":
            subprocess.Popen(["open", path])
        elif self.platform == "win32":
            subprocess.Popen(["explorer", path])
        elif self.platform == "linux":
            subprocess.Popen(["xdg-open", path])

    def executeCommand(self, command: str, socketio: SocketIO):
        """
        Executes a command in the OS terminal

        :param command: The command to execute
        """

        def runCommand(
            command: str, socketio: SocketIO
        ) -> typing.Optional[subprocess.Popen]:
            # Run a command in the os terminal and
            # capture the output and error in the same variable

            with subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
            ) as p:
                if p.stdout is not None:
                    for line in p.stdout:
                        socketio.emit("printTerm", line)
                if p.stderr is not None:
                    for line in p.stderr:
                        socketio.emit("printTerm", line)
                return p

        process = runCommand(command, socketio)
        if process:
            thread = threading.Thread(target=process.wait)
            thread.start()

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
        if overwriteCaution and not overwrite and self.server_mode:
            raise OverwriteException(
                name=flow["name"], path=flowPath, message="Trying to overwrite a flow."
            )

        # Set the current folder as the flow folder
        flow["path"] = flowPath

        # Set the date
        flow["date"] = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Save the flow (overwrite if already exists)
        with open(flowPath, "w") as f:
            json.dump(flow, f)

        # Add the flow to the recent flows list
        self._addToRecentFlows(flow)

        # Return the saved flow
        return flow

    def saveFlow(self, flow):
        overwrite = flow.get("overwrite")

        flowPath = flow.get("path")
        if not flowPath and flow.get("savedID") == "new_flow" and not overwrite:
            if not self.server_mode:
                filename = flow.get("name", "New flow") + ".flow"
                fileTypes = ("Flow (*.flow)",)
                flowPath = self.saveFileSelectDialog(filename, fileTypes=fileTypes)
                if not flowPath:
                    raise Exception("No path selected.")
                if not flowPath.endswith(".flow"):
                    flowPath += ".flow"
                flow["path"] = flowPath
                # flow["name"] = os.path.basename(flowPath).replace(".flow", "")
            else:
                flowPath = os.path.join("flows", flow.get("name") + ".flow")
                overwrite = True
                flow["path"] = flowPath
        return self._saveFlowInternal(flow, overwrite)

    def _openFlowInternal(self, flowPath):
        """
        Opens a flow from a file.
        """

        # Check that the file exists
        if not os.path.exists(flowPath):
            raise Exception("The flow file does not exist")

        # Read the flow file
        with open(flowPath, "r") as f:
            flow = json.load(f)

        # Set the flow path
        flow["path"] = flowPath

        # Add the flow to the recent flows list
        # self.addToRecentFlows(flow)

        # Return the flow
        return flow

    def openFlow(self):
        """
        Opens the file select dialog to open a flow.
        """
        if not self.server_mode:
            flowPath = self.openFileSelectDialog(
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

    @property
    def recentFlowsPath(self):
        """
        Returns the path to the recent flows file
        """

        path = os.path.join(self.appSupportDir, "recent_flows.json")

        if not os.path.exists(path):
            with open(path, "w") as f:
                json.dump([], f)

        return path

    def listRecentFlows(self) -> typing.Dict[str, typing.Dict[str, str]]:
        """
        Returns the list of recent flows
        """

        with open(self.recentFlowsPath, "r") as f:
            recentFlows: typing.Dict[str:str] = json.load(f)

        # If the recent flows is empty, create an empty dict
        if not recentFlows:
            recentFlows = {}

        return recentFlows

    def _addToRecentFlows(self, flow: typing.Dict[str, str]):
        """
        Adds a given flow to the recent flows list

        :param flow: The flow to add
        """

        recentFlows = self.listRecentFlows()

        # Add the flow to the recent flows list
        savedID = flow.get("savedID", None)

        if savedID is None:
            raise Exception("The flow does not have a savedID")

        recentFlows[savedID] = {
            "name": flow.get("name", "Unnamed flow"),
            "path": flow.get("path", None),
            "savedID": flow.get("savedID", None),
            "date": flow.get("date", None),
        }

        # Remove the oldest flow if the list is longer than 10
        while len(recentFlows) > 10:
            oldestFlow = None
            for savedID in recentFlows:
                if oldestFlow is None:
                    oldestFlow = savedID
                elif recentFlows[savedID]["date"] < recentFlows[oldestFlow]["date"]:
                    oldestFlow = savedID
            del recentFlows[oldestFlow]

        # Write the recent flows list to the file
        with open(self.recentFlowsPath, "w") as f:
            json.dump(recentFlows, f)

    def openRecentFlow(self, savedID: str):
        """
        Opens a recent flow

        :param savedID: The savedID of the flow to open
        """

        # Get the recent flows list
        recentFlows = self.listRecentFlows()

        # Check if the savedID exists
        flow = recentFlows.get(savedID, None)

        if flow is None:
            raise Exception("The savedID does not exist")

        return self._openFlowInternal(flow["path"])

    def cleanRecentFlows(self):
        """
        Cleans the recent flows list
        """

        with open(self.recentFlowsPath, "w") as f:
            json.dump({}, f)


class Setting:
    """
    A setting of the App
    """

    id = "unnamed_setting"
    """
    The ID of the setting
    """

    name = "Unnamed setting"
    """
    A short name of the setting
    """

    value = None
    """
    The value of the setting
    """

    description = "No description"
    """
    The description of the setting
    """

    category = "General"
    """
    The category of the setting
    """

    def __init__(
        self,
        id: str,
        name: str,
        value: typing.Any,
        description: str,
        category: str = "General",
    ):
        """
        Create a Setting instance

        :param id: The ID of the setting
        :param name: A short name of the setting
        :param value: The value of the setting
        :param description: The description of the setting
        """
        self.id = id
        self.name = name
        self.value = value
        self.description = description
        self.category = category

    # Define comparison operators
    def __eq__(self, other):
        return self.id == other.id

    def __ne__(self, other):
        return self.id != other.id

    # Define a method to get a JSON serializable dict of the setting
    def toDict(self):
        """
        Serializes the setting to a dict
        """

        return {
            "name": self.name,
            "value": self.value,
            "description": self.description,
            "category": self.category,
        }


class HorusSettings:
    """
    Manage the Horus app settings
    """

    settings: typing.Dict[str, Setting] = {}
    """
    The settings of the app

    :type: dict[str, Setting]
    - key: The ID of the setting
    - value: The setting instance
    """

    def __init__(self, appSupportDir: str) -> None:
        """
        Manage and load the settings of the app

        :param appSupportDir: The path to the app support directory
        """

        # Define the default settings path based on if the app is frozen
        try:
            bundle_dir = sys._MEIPASS  # type: ignore
            self.defaultSettingsPath = os.path.abspath(
                os.path.join(bundle_dir, "default_settings.json")
            )
        except AttributeError:
            self.defaultSettingsPath = os.path.join("App", "default_settings.json")

        # Define the user settings path
        self.userSettingsPath = os.path.join(appSupportDir, "settings.json")

        # Load the settings
        self._loadSettings()

    def _createSettings(self):
        """
        If no settings file exists, create one with the default settings
        """

        # Check if the default settings file exists
        if not os.path.exists(self.defaultSettingsPath):
            raise Exception("The default settings file does not exist")

        # Load the default settings
        with open(self.defaultSettingsPath, "r") as f:
            defaultSettings = json.load(f)

        # Write the default settings to the user settings file
        with open(self.userSettingsPath, "w") as f:
            json.dump(defaultSettings, f)

    def _loadSettings(self):
        """
        Loads the settings from the settings file
        """

        # Check if the settings file exists
        if not os.path.exists(self.userSettingsPath):
            # Create the settings file
            self._createSettings()

        # Load the settings
        with open(self.userSettingsPath, "r") as f:
            fileSettings = json.load(f)

        # Instantiate the settings
        self.settings = {}
        for key, value in fileSettings.items():
            try:
                newSetting = Setting(
                    key,
                    value["name"],
                    value["value"],
                    value["description"],
                    value["category"],
                )
            except KeyError:
                print("The setting file is corrupted for setting", key)
                continue

            # If the setting already exists, raise an exception
            if newSetting.id in self.settings:
                raise Exception(
                    f"The setting {newSetting.id} is duplicated.\
                    Make sure that each setting has a unique ID."
                )

            # Add the setting to the settings list
            self.settings[newSetting.id] = newSetting

    def getSetting(self, id: str) -> Setting:
        """
        Returns a setting by its ID

        :param id: The ID of the setting
        """

        # Get the setting
        setting = self.settings.get(id, None)

        if setting is None:
            raise Exception("The setting does not exist")

        return setting

    def restoreDefaults(self):
        """
        Restores the default settings
        """

        # Load the default settings
        with open(self.defaultSettingsPath, "r") as f:
            defaultSettings = json.load(f)

        # Write the default settings to the user settings file
        with open(self.userSettingsPath, "w") as f:
            json.dump(defaultSettings, f)

        # Reload the settings
        self._loadSettings()

    def updateSetting(self, setting: Setting):
        """
        Updates a setting

        :param setting: The setting instance updated to save
        """

        self.settings[setting.id] = setting

        # Save the settings
        self.saveSettings()

    def saveSettings(self):
        """
        Updates the user settings file
        """

        settingsToSave = {}

        for id, setting in self.settings.items():
            settingsToSave[id] = setting.toDict()

        # Save the settings
        with open(self.userSettingsPath, "w") as f:
            json.dump(settingsToSave, f)

    def listSettings(self):
        """
        Returns the list of settings as a JSON object
        """

        with open(self.userSettingsPath, "r") as f:
            settings = json.load(f)

        return settings


def LaunchApp():
    # Check for the --debug flag (-d) (Only development)
    # Forces the server to run in debug mode
    debug = False
    debugURL = None
    if ("--debug" in sys.argv or "-d" in sys.argv) and not cython.compiled:
        debug = True

        # Check for the -f --force-production flag
        if "--force-production" in sys.argv or "-f" in sys.argv:
            debug = False

        # Check for the --url (-u) flag
        if "--url" in sys.argv or "-u" in sys.argv:
            index = (
                sys.argv.index("--url") if "--url" in sys.argv else sys.argv.index("-u")
            )
            try:
                debugURL = sys.argv[index + 1]
            except IndexError:
                print("No debug URL provided. Usage: -d -u <url>")
                sys.exit(1)

    # Check for the --browser (-b) flag
    browser = False
    if "--browser" in sys.argv or "-b" in sys.argv:
        browser = True

    # Check for the --server (-s) flag
    server_mode = False
    if "--server" in sys.argv or "-s" in sys.argv:
        if browser:
            browser = False
            print("Server mode overrides browser mode")
        server_mode = True

    # Prepare the app delegate
    app = AppDelegate(debug, server_mode, browser, debugURL)
    """
    App Delegate is a singleton class that will handle the app
    """

    # Start the app. This is a blocking process.
    app.applicationDidFinishLaunching()

    # Execute after the app is terminated
    app.applicationWillTerminate()
