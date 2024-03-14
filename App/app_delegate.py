"""
App Delegate
"""

import multiprocessing

# Basic imports
import sys
import os
import threading
import subprocess
import webbrowser
import logging
import datetime

# Import type annotations
import typing

# Compilation variables (cython.compiled)
import cython

# PyWebview
import webview
import webview.menu as wm

# Server
import requests
from flask_socketio import SocketIO
from Server import HorusServer
from HorusAPI import HorusSingleton


# Add to the pythonpath the path of the project
sys.path.append("../")


class HorusLogger:
    """
    Logger for the app in production mode
    """

    horus: logging.Logger
    """
    The main logger for the app
    """

    capturer: logging.Logger
    """
    The logger for stdout and stderr
    """

    root: logging.Logger
    """
    The root logger
    """

    def __init__(self, appSupportDir: str, debug: bool = False) -> None:
        # Define the logs folder
        self.logDir = os.path.join(appSupportDir, "logs")

        # Define debug
        self.debug = debug

        # Create the logs folder if it doesn't exist
        if not os.path.exists(self.logDir):
            os.mkdir(self.logDir)

        # Clean the logs folder
        self._cleanLogs()

        # Init the logger
        self._initLogger()

    def _cleanLogs(self):
        """
        Clean the oldes logs if there are more than 5
        """
        # If there are more than 5 logs inside the logs folder,
        # delete the oldest one
        logs = os.listdir(self.logDir)
        if len(logs) > 5:
            logs = [os.path.join(self.logDir, log) for log in logs]
            oldestLog = min(logs, key=os.path.getctime)
            os.remove(os.path.join(self.logDir, oldestLog))

    def _initLogger(self):
        """
        Init a new logger
        """

        # Horus logger
        self.horus = logging.getLogger("Horus")
        self.horus.setLevel(logging.NOTSET)

        # Create new logger for stdout and stderr
        self.capturer = logging.getLogger("Capturer")
        self.capturer.setLevel(logging.NOTSET)

        # Start a new log
        logname = "Horus-"
        if self.debug:
            logname += "debug"
        else:
            date = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
            logname += date
        logFile = os.path.join(self.logDir, f"{logname}.log")

        # Create the file handler
        fh = logging.FileHandler(logFile)  # pylint: disable=invalid-name
        fh.setLevel(logging.NOTSET)

        class ColoredFormatter(logging.Formatter):
            """
            Colors for the logger
            """

            # Different colors for different log levels
            COLOR_CODES = {
                "DEBUG": "\033[1;34m",  # Blue
                "INFO": "\033[1;32m",  # Green
                "WARNING": "\033[1;33m",  # Yellow
                "ERROR": "\033[1;31m",  # Red
                "CRITICAL": "\033[1;35m",  # Magenta
            }
            RESET_CODE = "\033[0m"  # Reset to default color
            # White for the capturer
            CAPTURER_COLOR = "\033[1;37m"

            def format(self, record):

                # Define the colors for the log levels
                logLevelColor = self.COLOR_CODES.get(record.levelname, "")

                if record.name == "Capturer":
                    # Apply the white color for the capturer
                    logLevelColor = self.CAPTURER_COLOR

                # Apply the colors
                formatted = super().format(record)
                colored = f"{logLevelColor}{formatted}{self.RESET_CODE}"

                return colored

        # Create color formatter and add it to the console handler
        colorFormatter = ColoredFormatter(
            "%(asctime)s - %(name)s - %(levelname)s: %(message)s", "%Y-%m-%d %H:%M:%S"
        )

        # Create regular formatter and add it to the file handler
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s: %(message)s", "%Y-%m-%d %H:%M:%S"
        )
        fh.setFormatter(formatter)

        # Add the handler to the root logger
        self.root = logging.getLogger()
        self.root.setLevel(logging.NOTSET)
        self.root.addHandler(fh)

        # Store the old stdout and stderr
        oldStdout = sys.stdout
        oldStderr = sys.stderr

        class FakeWriter:
            """
            Fake writer class
            """

            def __init__(
                self, level: int, capturer: logging.Logger, oldStdOutErr, debug: bool = False
            ) -> None:
                self.debug = debug
                """
                Controls whether to print the logs to the old stdout and stderr

                Needed in debug mode orthewise will be printed twice
                """

                self.level = level
                """
                The level of the fake writer
                """

                self.capturer = capturer
                """
                The STDOUT and STDERR capturer
                """

                self.oldStdOutErr = oldStdOutErr
                """
                The old STDOUT and STDERR to print to
                """

            def write(self, message):
                """
                Hook into the default stdout and stderr class
                """
                try:
                    for line in message.rstrip().splitlines():
                        self.capturer.log(self.level, line.rstrip())
                        if self.level < logging.WARNING and not self.debug:
                            self.oldStdOutErr.write(f"{line}\n")
                except BaseException:
                    pass

            def flush(self):
                """
                Hook the flush method
                """

        # Set as the new stdout and stderr the capturer
        sys.stdout = FakeWriter(logging.INFO, self.capturer, oldStdout, debug=self.debug)
        sys.stderr = FakeWriter(logging.ERROR, self.capturer, oldStderr, debug=self.debug)

        # If we are on debug, print all the loggers to the old stdout and stderr
        if self.debug:
            rootDebugHandler = logging.StreamHandler(oldStdout)
            rootDebugHandler.setLevel(logging.NOTSET)
            rootDebugHandler.setFormatter(colorFormatter)
            self.root.addHandler(rootDebugHandler)
        else:
            # Set the level of the root logger to INFO
            self.root.setLevel(logging.INFO)

            # Crital and error logs to the old stderr
            rootErrorHandler = logging.StreamHandler(oldStderr)
            rootErrorHandler.setLevel(logging.ERROR)
            rootErrorHandler.setFormatter(colorFormatter)
            self.root.addHandler(rootErrorHandler)


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


class AppDelegate(metaclass=HorusSingleton):
    """
    The AppDelegate class
    """

    @property
    def windows(self):
        """
        All of the windows that are currently open
        """

        openedWindows: typing.List[webview.Window] = webview.windows

        return openedWindows

    APP_INFO: typing.Dict[str, typing.Any] = {}
    """
    Stores relevant information about the app, such as

    - name: The name of the app
    - version: The version of the app
    - bundleIdentifier: The bundle identifier of the app
    """

    serverThread: typing.Optional[threading.Thread] = None
    """
    The separate thread where the server runs
    """

    logger: HorusLogger
    """
    The Horus logger
    """

    _server: HorusServer
    """
    The Horus server instance
    """

    _triedToStartServer: int = 0
    """
    The number of trials to start the server
    """

    @property
    def server(self) -> HorusServer:
        """
        Returns the Horus server if it exists. Otherwise, initializes it.
        """

        if not hasattr(self, "_server"):
            # If we tried to start the server more than 2 times, exit
            if self._triedToStartServer > 1:
                print("Error starting server. Exiting...")
                sys.exit(1)

            # Try to start the server
            self._triedToStartServer += 1

            msg = "Server not initialized. "
            if cython.compiled:
                msg += "Please report this issue to the developers."
            else:
                msg += "Ignore this warning if you are running tests."

            print(msg)
            logging.warning(msg)

            self.initializeServer()

        return self._server

    def __init__(
        self,
        debug: bool = False,
        mode: str = "app",
        debugURL: typing.Optional[str] = None,
        host: typing.Optional[str] = None,
        port: typing.Optional[int] = None,
    ):
        """
        Initialize the AppDelegate.
        This will start the backend server and create the first window.
        """
        self.debug = debug
        self.mode = mode
        self.debugURL = debugURL
        self.host = host
        self.port = port

        self.desktop = self.mode == "app" or self.mode == "browser"
        """
        Handy variable for checking if we are running in "Desktop" app or just as a server
        """

        self.safeMode = self.mode == "webapp"
        """
        Handy variable for checking if we are running in "WebApp" mode, thus "safe mode"
        """

        # Load the app info from the APP_INFO file
        self._loadAppInfo()

        # Set the app support directory
        self._appSupportDir()

        # Start the logger if needed
        self._loadLogger()

        # Setup special platform requirements
        self._internalPlatformSetup()

    def _internalPlatformSetup(self):
        """
        Setup special platform requirements
        """

        # If we are on macOS, set the enviornment to disable some thread safety
        # This is needed for subprocessing the blocks
        if self.platform == "darwin":
            os.environ["OBJC_DISABLE_INITIALIZE_FORK_SAFETY"] = "YES"
            os.environ["DISABLE_SPRING"] = "YES"

    def initializeServer(self):
        """
        Initializes the server, the PluginManager, the FlowManager
        the Settings and the RemoteManager
        """

        # Initialize only if not previously initialized
        if hasattr(self, "_server"):
            return

        # Prepare the server
        self._server = HorusServer(
            debug=self.debug,
            mode=self.mode,
            appSupportDir=self.appSupportDir,
            host=self.host,
            port=self.port,
        )

    def _loadLogger(self):
        """
        Starts a logger in production mode
        """

        self.logger = HorusLogger(self.appSupportDir, debug=self.debug)

        # Log the date and app info
        self.logger.horus.info("Starting Horus %s", self.APP_INFO["APP_VERSION"])
        self.logger.horus.info("Platform: %s", self.platform)
        self.logger.horus.info("Debug: %s", self.debug)
        self.logger.horus.info("Horus mode: %s", self.mode)
        self.logger.horus.info("Debug URL: %s", self.debugURL)
        self.logger.horus.info("AppSupport Dir: %s", self.appSupportDir)

    def _loadAppInfo(self):
        """
        Loads the app info from the APP_INFO file.
        """

        # Get the path to the APP_INFO file
        if hasattr(sys, "_MEIPASS"):
            envPath = os.path.join(sys._MEIPASS, "APP_INFO")  # type: ignore pylint: disable=protected-access
        else:
            envPath = os.path.join("App", "APP_INFO")

        # Load the app info from the APP_INFO file
        with open(envPath, "r", encoding="utf-8") as file:
            lines = file.readlines()

        appInfo: typing.Dict[str, str] = {}
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

        # Set the key "APP_VERSION" to the version of the HorusAPI
        try:
            import HorusAPI

            appInfo["APP_VERSION"] = HorusAPI.__version__
        except Exception:
            self.logger.horus.critical(
                "Error loading HorusAPI version. Horus may not work properly"
            )

        self.APP_INFO = appInfo  # pylint: disable=invalid-name

    def _appSupportDir(self):
        # If we are, use the default system Application Support directory
        # On macOS this is ~/Library/Application Support
        # On Windows this is %APPDATA%
        # On Linux this is ~/.local/share
        self.platform = sys.platform

        if hasattr(sys, "_MEIPASS"):
            appFolderName = self.APP_INFO["BUNDLE_IDENTIFIER"].lower().replace(" ", "")

            if self.platform == "darwin":
                appSupportDir = os.path.join(
                    os.path.expanduser("~"),
                    "Library",
                    "Application Support",
                    appFolderName,
                )
            elif self.platform == "win32":
                appSupportDir = os.getenv("APPDATA")
                if appSupportDir is not None:
                    appSupportDir = os.path.join(appSupportDir, appFolderName)
                else:
                    raise Exception(  # pylint: disable=broad-exception-raised
                        "APPDATA environment variable not set"
                    )
            elif self.platform == "linux":
                appSupportDir = os.path.join(
                    os.path.expanduser("~"),
                    ".local",
                    "share",
                    appFolderName,
                )
            else:
                raise Exception(  # pylint: disable=broad-exception-raised
                    f"Unsupported platform {self.platform}"
                )

        else:
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

        self.serverThread = threading.Thread(target=self.server.run)
        self.serverThread.daemon = True
        self.serverThread.start()

    def openWindow(
        self,
        title: str,
        url: typing.Optional[str] = None,
        wo: WindowOptions = WindowOptions(),  # pylint: disable=invalid-name
        forceNew: bool = False,
    ) -> webview.Window:
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
                    return window

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

        # Return the window
        return window

        # Add the window to the list of windows
        # self.windows.append(window) # Not neccessary using the webview module

    def _extraInfoData(self):
        """
        Populate the App Info with extra data
        """

        def getOsName():
            # Obtain the OS version too
            import platform

            if self.platform == "darwin":
                return "macOS " + platform.mac_ver()[0]
            if self.platform == "win32":
                return "Windows " + platform.release()
            if self.platform == "linux":
                return "Linux " + platform.release()
            return "Unknown"

        # Load extra data to the app info
        self.APP_INFO["platform"] = getOsName()
        self.APP_INFO["debug"] = self.debug
        self.APP_INFO["mode"] = self.mode
        self.APP_INFO["appSupportDir"] = self.appSupportDir

    def applicationDidFinishLaunching(self):
        """
        This will be called when the app is launched.
        It will create the first window and launch the app
        """

        # Populate the App Info with extra data
        self._extraInfoData()

        # Initialize the server
        self.initializeServer()

        if self.mode == "browser":
            # Start browser mode
            self._startBrowserMode()
        elif self.mode == "server" or self.mode == "webapp":
            # Start server mode
            self._startServerMode()
        else:
            # Start app mode
            self._startAppMode()

    def applicationWillTerminate(self):
        """
        This will be called after the last window is closed.
        """

        # If any flow is running, pause them
        if self.server.flowManager and self.server.flowManager.areThereRunningFlows:
            self.server.flowManager.pauseAllFlows()

        # End all the child processes
        for process in multiprocessing.active_children():
            process.terminate()

    # FIXME: REMOVE THIS
    def _menus(self):
        def newHorus():
            self.openWindow("Horus", forceNew=True)

        def openPlugins():
            pluginsURL = self.server.baseURL + "/plugins/"
            pluginsURL = self.tokenize(pluginsURL)
            pluginWindow = self.openWindow("Plugins", url=pluginsURL)

            import json

            internalInfo = json.dumps(
                {
                    "isDesktop": self.desktop,
                    "mode": self.mode,
                }
            )

            pluginWindow.evaluate_js(f"window.horusInternal = {internalInfo}")

        def aboutHorus():
            aboutURL = self.server.baseURL + "/about"
            aboutURL = self.tokenize(aboutURL)
            self.openWindow("About Horus", url=aboutURL)

        def settings():
            settingsURL = self.server.baseURL + "/settingsview"
            settingsURL = self.tokenize(settingsURL)
            self.openWindow("Settings", url=settingsURL)

        fileMenu = wm.Menu(
            "File",
            [  # type: ignore
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
                wm.MenuAction(  # type: ignore
                    "Manage...",
                    openPlugins,
                )
            ],
        )

        def openRemotes():
            self.openWindow("Remotes", url=self.server.baseURL + "/remotes")

        settingsMenu = wm.Menu(
            "Settings",
            [  # type: ignore
                wm.MenuAction("Settings", settings),
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
        while True:
            try:
                requests.get(self.server.baseURL, timeout=1)
                break
            except requests.exceptions.ConnectionError:
                pass

        def guiBacked() -> str:
            # Check in the args for the --gui=qt or --gui=gtk
            # Or in the env variable HORUS_GUI
            for arg in sys.argv:
                if arg.startswith("--gui="):
                    return arg.split("=")[1]

            envGUI = os.getenv("HORUS_GUI")
            if envGUI is not None:
                return envGUI

            # Default to "cocoa" on macOS
            # and "gtk" on Linux
            return "cocoa" if self.platform == "darwin" else "gtk"

        homeURL = self.server.baseURL

        windowOptions = WindowOptions()
        if self.mode == "browser":
            homeURL += "/bmode"
            windowOptions.width = 300
            windowOptions.height = 250
            windowOptions.confirm_close = True  # pylint: disable=invalid-name
            windowOptions.resizable = False
            windowOptions.on_top = True  # pylint: disable=invalid-name
        else:
            windowOptions.width = 1200
            windowOptions.height = 800

        if self.debugURL is not None:
            # homeURL = f"{self.server.baseURL}/{self.debugURL}"
            homeURL = self.debugURL

        homeURL = self.tokenize(homeURL)

        # Open the first window
        self.openWindow("Horus", url=homeURL, wo=windowOptions)

        # Start the webview
        webview.start(debug=self.debug, menu=self._menus(), gui=guiBacked())  # type: ignore

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

    def openURL(self, url: str):
        """
        Opens a browser window to the server link.
        """
        # Opens a browser window to the server link
        webbrowser.open(url)

    def openFileSelectDialog(
        self,
        allowMultiple: bool = False,
        fileTypes: typing.Tuple[str, ...] = ("All Files (*.*)",),
    ) -> typing.Optional[typing.Sequence[str]]:
        """
        Opens a file dialog and returns the path of the selected file(s).

        :param allowMultiple: Allow the user to select multiple files
        :param fileTypes: A tuple of strings of file types to filter the files.
        The tuple must be in the format:
        ("Description (*.ext1;*.ext2...)", "Description 2 (*.ext3;*.ext4...)")

        :returns: A tuple of strings of the selected files
        """

        # Get the active window
        window = webview.windows[0]

        # Open the file dialog
        result: typing.Optional[typing.Sequence[str]] = window.create_file_dialog(
            webview.OPEN_DIALOG, allow_multiple=allowMultiple, file_types=fileTypes
        )

        if result is None:
            return None

        if allowMultiple:
            # Loop over the files and ensure all are str paths
            result = [str(file) for file in result]
        else:
            # Ensure the result is a string
            if isinstance(result, typing.Sequence):
                result = "".join(result)

            result = str(result)

        return result

    def openFolderSelectDialog(self) -> typing.Optional[str]:
        """
        Opens a folder dialog and returns the path of the selected folder.
        """
        # Get the active window
        window = webview.windows[0]

        # Open the folder dialog
        result: typing.Optional[typing.Sequence[str]] = window.create_file_dialog(
            webview.FOLDER_DIALOG, allow_multiple=False
        )

        if isinstance(result, tuple):
            # On linux, depending on the desktop environment
            # the result is a tuple instead of a string
            result = "".join(result)

        # Always return a string
        return str(result)

    def saveFileSelectDialog(
        self,
        fileName: str = "flow",
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
        # if self.platform == "darwin":
        #     result = str(result)

        if isinstance(result, typing.Sequence):
            result = "".join(result)

        # Always return a string
        return str(result)

    @staticmethod
    def tokenize(url: str):
        """
        Adds to an url the shemsu as a query parameter.
        """
        return f"{url}?shemsu={webview.token}"

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

        def runCommand(command: str, socketio: SocketIO) -> typing.Optional[subprocess.Popen]:
            # Run a command in the os terminal and
            # capture the output and error in the same variable

            with subprocess.Popen(
                command,
                shell=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                universal_newlines=True,
            ) as process:
                if process.stdout is not None:
                    for line in process.stdout:
                        socketio.emit("printTerm", line)
                if process.stderr is not None:
                    for line in process.stderr:
                        socketio.emit("printTerm", line)
                return process

        process = runCommand(command, socketio)
        if process:
            thread = threading.Thread(target=process.wait)
            thread.start()


def parseArgs() -> typing.Dict[str, typing.Any]:
    """
    Parse the arguments to the AppDelegate
    """

    debugReachable = not cython.compiled

    # If the password was provided along with the debug flag,
    # enter debug mode in production
    debugPassword = "horus_debug"
    if "--password" in sys.argv and not debugReachable:
        index = sys.argv.index("--password")
        try:
            password = sys.argv[index + 1]
            # Check if the password is correct
            if password == debugPassword:
                print("Entering debug mode in production")
                debugReachable = True
        except IndexError:
            # Keep quiet if no password was provided
            pass

    # Check for the --debug flag (-d) (Only development and in production with password)
    # Forces the server to run in debug mode
    debug = False
    debugURL = None
    if ("--debug" in sys.argv or "-d" in sys.argv) and debugReachable:
        debug = True

        # Check for the --force-production flag
        if "--force-production" in sys.argv:
            debug = False

        # Check for the --url (-u) flag
        if "--url" in sys.argv or "-u" in sys.argv:
            index = sys.argv.index("--url") if "--url" in sys.argv else sys.argv.index("-u")
            try:
                debugURL = sys.argv[index + 1]
            except IndexError:
                print("No debug URL provided. Usage: -d -u <url>")
                sys.exit(1)

    # Parse the mode of the app
    mode: str = "app"  # Default mode is App / Desktop

    # Check for the --browser (-b) flag
    if "--browser" in sys.argv or "-b" in sys.argv or os.getenv("HORUS_MODE") == "browser":
        mode = "browser"

    # Check for the --server (-s) flag
    if "--server" in sys.argv or "-s" in sys.argv or os.getenv("HORUS_MODE") == "server":
        mode = "server"

    # Check for the --webapp (-w) flag
    if "--webapp" in sys.argv or "-w" in sys.argv or os.getenv("HORUS_MODE") == "webapp":
        mode = "webapp"

    # Check for the --port (-p) flag to force a port on the app
    port = None
    envPort = os.getenv("HORUS_PORT")
    if "--port" in sys.argv or "-p" in sys.argv:
        index = sys.argv.index("--port") if "--port" in sys.argv else sys.argv.index("-p")
        try:
            port = int(sys.argv[index + 1])
        except IndexError:
            print("No port provided. Usage: -p <port>")
            sys.exit(1)
        except ValueError:
            print("Invalid port provided. Usage: -p <integer>")
            sys.exit(1)
    elif envPort is not None:
        try:
            port = int(envPort)
        except ValueError:
            print("Invalid port provided. Usage: -p <integer>")
            sys.exit(1)

    # Check for the --host (-h) flag to force a host on the app
    host = None
    envHost = os.getenv("HORUS_HOST")
    if "--host" in sys.argv or "-h" in sys.argv:
        index = sys.argv.index("--host") if "--host" in sys.argv else sys.argv.index("-h")
        try:
            host = sys.argv[index + 1]
        except IndexError:
            print("No host provided. Usage: -h <host>")
            sys.exit(1)
    elif envHost is not None:
        host = envHost

    # Parse the arguments
    args = {
        "debug": debug,
        "mode": mode,
        "debugURL": debugURL,
        "host": host,
        "port": port,
    }

    return args


def runFlowInsteadOfLaunch(app: AppDelegate):
    """
    If a flow was provided as an argument, it will run the flow instead of launching the app.
    """

    # Check for the --flow (-f) flag to run a flow instead of the app
    # The -f flag should be followed by the path to the flow and the
    # intex of the block to run -i <index>
    if "--flow" in sys.argv or "-f" in sys.argv:
        index = sys.argv.index("--flow") if "--flow" in sys.argv else sys.argv.index("-f")
        try:
            flowPath = sys.argv[index + 1]
        except IndexError:
            print("No flow path provided. Usage: -f <flow path>")
            sys.exit(1)

        if not os.path.exists(flowPath):
            print(f"Flow path {flowPath} does not exist")
            sys.exit(1)

        # Get the index of the block to run
        blockIndex = None
        if "-i" in sys.argv:
            index = sys.argv.index("-i")
            try:
                blockIndex = int(sys.argv[index + 1])
            except IndexError:
                print("No block index provided. Usage: -i <block index>")
                sys.exit(1)
            except ValueError:
                print("Invalid block index provided. Usage: -i <block index>")
                sys.exit(1)

        if app.server.flowManager is None:
            raise Exception(
                "Flow manager not initialized. This is a bug with Horus, please report it."
            )

        # Open the flow
        flow = app.server.flowManager.openFlowFromPath(flowPath)

        # Assign the global HorusSettings instance to the flow
        # TODO: Read for the users settings instead!
        flow.horusSettings = app.server.settingsManager

        # Run the flow
        try:
            flow.run(placedID=blockIndex, resetRemoteBlock=True)
        except Exception as error:
            print(f"Error running flow: {error}")

        # Exit
        sys.exit(0)


def launchApp():
    """
    Launches the app.
    """

    args = parseArgs()

    # Prepare the app delegate
    app = AppDelegate(**args)

    # Initialize the server
    try:
        app.initializeServer()
    except Exception as exc:
        import traceback

        logging.getLogger("Horus").critical(
            "Error initializing server: %s", traceback.format_exc() if app.debug else str(exc)
        )
        sys.exit(1)

    # If a flow was provided as an argument, it will run the flow instead of launching the app.
    runFlowInsteadOfLaunch(app)

    # Start the app. This is a blocking process.
    app.applicationDidFinishLaunching()

    # Execute after the app is terminated
    app.applicationWillTerminate()
