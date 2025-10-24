"""
App Delegate
"""

# Basic imports
import sys
import os
import threading
import subprocess
import webbrowser
import logging
import datetime
import argparse
import platform
import debugpy
import time
from contextlib import contextmanager

# Import type annotations
import typing

# Wait till the server is ready
import requests

# PyWebview
import webview
import webview.menu as wm

# Supress several warnings
import warnings

# For the PluginDeps class
# Suppress pkg_resources deprecation warnings
warnings.filterwarnings("ignore", message=".*pkg_resources.*")

# For multiprocessing (leaked semaphore message when closing Horus)
warnings.filterwarnings("ignore", message=".*resource_tracker.*")

# Multiprocessing
if typing.TYPE_CHECKING:
    import multiprocessing as mp
else:
    import multiprocess as mp

# Server (ignore import order because we need first to filter warnings)
from Server import HorusServer  # noqa: E402
from Server.Utils import PrintTruncator  # noqa: E402
from HorusAPI import HorusSingleton, __version__  # noqa: E402


# Add to the pythonpath the path of the project
sys.path.append("../")

FLOWPATH: typing.Optional[str] = None
"""
Variable only used to log the Flows, not the application itself

Used in HorusLogger
"""


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

    latestLogFile: str
    """
    The path to the current (and latest) log file
    """

    def __init__(self, appSupportDir: str, debug: bool = False, verbose: bool = False) -> None:

        # Define the logs folder
        self.logDir = os.path.join(appSupportDir, "logs")

        # Define debug & verbose
        self.debug = debug
        self.verbose = verbose

        # Create the logs folder if it doesn't exist
        if not os.path.exists(self.logDir):
            os.mkdir(self.logDir)

        # Clean the logs folder
        # DISABLED AS NO NEED TO REMOVE OLD LOGS
        # self._cleanLogs()

        # Init the logger
        self._initLogger()

    def _cleanLogs(self):
        """
        Clean the oldes logs if there are more than 25
        """
        # If there are more than 5 logs inside the logs folder,
        # delete the oldest one
        try:
            logs = os.listdir(self.logDir)  # type: ignore
            if len(logs) > 25:
                logs = [os.path.join(self.logDir, log) for log in logs]
                oldestLog = min(logs, key=os.path.getctime)
                os.remove(os.path.join(self.logDir, oldestLog))
        except Exception as exc:
            logging.getLogger("Horus").error("Could not clean oldest log files: %s", str(exc))

    def _initLogger(self):
        """
        Init a new logger
        """

        # Horus logger
        self.horus = logging.getLogger("Horus")
        self.horus.setLevel(logging.NOTSET)

        # Create new logger for stdout and stderr
        self.capturer = logging.getLogger("print")
        self.capturer.setLevel(logging.NOTSET)

        class FilterCapturer(logging.Filter):
            """
            Filter class for the logging filter
            """

            def filter(self, record):
                """
                Filter method for the logging filter.

                This method is used to determine whether a log
                record should be included in the log output.
                It takes a log record as input and returns a boolean value.

                Parameters:
                    record (logging.LogRecord): The log record to be filtered.

                Returns:
                    bool: True if the log record should be included in
                    the log output, False otherwise.
                """
                return not record.getMessage() == "\n"

        self.capturer.addFilter(FilterCapturer())

        # Start a new log
        logname = f"{datetime.datetime.now().strftime('%Y-%m-%d-%H-%M-%S')}-Horus-"

        if self.debug:
            logname += "debug"

        # If we are running a flow instead of running Horus, add "flow-{flowname}" to the logname
        if FLOWPATH:
            logname += f"-FLOWRUN-{os.path.basename(FLOWPATH).replace('.flow', '')}"
            self.logDir = os.path.dirname(FLOWPATH)
            print(f"Logging FLOWRUN to {self.logDir}")

        logFile = os.path.join(self.logDir, f"{logname}.log")

        # Generate emtpy file
        with open(logFile, "w", encoding="utf-8") as f:
            f.write("")

        self.latestLogFile = os.path.join(self.logDir, "latest.log")

        # Do not create symlink for FLOWRUN logs
        if not FLOWPATH:
            # Generate a symlink to the latest log as "latest.log"
            if os.path.exists(self.latestLogFile):
                os.remove(self.latestLogFile)

            os.symlink(logFile, self.latestLogFile)

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

                oldFormat = self._style._fmt
                if record.name == "print" and record.levelno < logging.ERROR:

                    # Exclude the log level for the capturer
                    formatStr = oldFormat.replace(" - %(levelname)s", "")
                    self._style._fmt = formatStr

                    # Apply the white color for the capturer
                    logLevelColor = self.CAPTURER_COLOR

                # Apply the colors
                formatted = super().format(record)
                colored = f"{logLevelColor}{formatted}{self.RESET_CODE}"

                # Restore the old format
                self._style._fmt = oldFormat

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

        class FakeWriter(PrintTruncator):
            """
            Fake writer class
            """

            def __init__(
                self,
                level: int,
                capturer: logging.Logger,
                oldStdOutErr,
                debug: bool = False,
                verbose: bool = False,
            ) -> None:
                self.debug = debug
                """
                Controls whether to print the logs to the old stdout and stderr

                Needed in debug mode orthewise will be printed twice
                """

                self.verbose = verbose
                """
                Controls whether to print the logs to the old stdout and stderr
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

                # Initialize the base class io.StringIO properly
                super().__init__()

            def write(self, message: str):
                """
                Hook into the default stdout and stderr class
                """

                message = self.format(message)

                try:

                    if not self.debug and not self.verbose:
                        self.oldStdOutErr.write(message)

                    # Remove empty lines
                    if message.endswith("\n"):
                        message = message[:-1]

                    if message == "":
                        return

                    self.capturer.log(self.level, message)

                except BaseException:
                    pass

        # Set as the new stdout and stderr the capturer
        sys.stdout = FakeWriter(
            logging.INFO,
            self.capturer,
            oldStdout,
            debug=self.debug,
            verbose=self.verbose,
        )
        sys.stderr = FakeWriter(
            logging.ERROR,
            self.capturer,
            oldStderr,
            debug=self.debug,
            verbose=self.verbose,
        )

        # If we are on debug, print all the loggers to the old stdout and stderr
        if self.debug or self.verbose:
            rootDebugHandler = logging.StreamHandler(oldStdout)
            rootDebugHandler.setLevel(logging.NOTSET if self.debug else logging.INFO)
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

    @classmethod
    @contextmanager
    def mute(cls, level: int = logging.CRITICAL + 1):
        """
        Temporarily mute all loggers below the given level

        Default is to mute all.
        """

        horus_logger = logging.getLogger("Horus")
        prev_lebel = horus_logger.level
        horus_logger.setLevel(level)
        try:
            yield
        finally:
            horus_logger.setLevel(prev_lebel)


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

    @property
    def isCompiled(self) -> bool:
        """
        Returns whether the app is compiled
        """

        return getattr(sys, "frozen", False)

    @property
    def bundleDir(self) -> str:
        """
        Returns the bundle directory.

        If uncompiled, it returns the current working directory
        """

        return getattr(sys, "_MEIPASS", os.getcwd())

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

    verbose: bool = False
    """
    Whether the app is in verbose mode. This will print all logs
    into the console apart from the logfile.
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
            if hasattr(sys, "_MEIPASS"):
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
        root: typing.Optional[str] = None,
        verbose: bool = False,
        debugPlugins: bool = False,
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
        self.root = root
        self.verbose = verbose
        self.debugPlugins = debugPlugins

        self.desktop = self.mode == "app" or self.mode == "browser"
        """
        Handy variable for checking if we are running in "Desktop" app or just as a server
        """

        self.safeMode = self.mode == "webapp"
        """
        Handy variable for checking if we are running in "WebApp" mode, thus "safe mode"
        """

        # Obtain platform information
        self.platform = sys.platform

        # Setup special platform requirements
        self._internalPlatformSetup()

        # Load the app info from the APP_INFO file
        self._loadAppInfo()

        # Set the app support directory
        self._appSupportDir()

        # Start the logger if needed
        self._loadLogger()

    def _loadDebugpy(self):
        """
        Prepare debugpy if needed
        """
        if self.debugPlugins:
            self.logger.horus.info("Starting debugpy...")

            # Get debugpy port from environment variables or use defaults
            timeout = int(os.getenv("HORUS_DEBUGPY_TIMEOUT") or 10)
            if FLOWPATH:
                # For flows, use HORUS_DEBUGPY_FLOW_PORT or default to 5679
                default_port = 5679
                env_var = "HORUS_DEBUGPY_FLOW_PORT"
            else:
                # For regular app, use HORUS_DEBUGPY_PORT or default to 5678
                default_port = 5678
                env_var = "HORUS_DEBUGPY_PORT"

            debugpy_port = int(os.getenv(env_var) or default_port)

            if not debugpy.is_client_connected():

                # Load the external python manager to get the validated python path
                from Server.SettingsManager import SettingsManager
                from Server.PluginManager import ExternalPython

                external_python = ExternalPython(SettingsManager(self.appSupportDir))

                try:
                    python = external_python.interpreter_path
                    print(
                        f"Debugpy started with helper interpreter: {python}. "
                        f"Waiting for debugger to attach to port {debugpy_port}..."
                    )
                    debugpy.configure(python=python)
                    debugpy.listen(debugpy_port)
                    start_time = time.time()
                    while not debugpy.is_client_connected():
                        if time.time() - start_time > timeout:
                            print(
                                "Timeout waiting for debugger to attach after"
                                f" {timeout} seconds."
                            )
                            break
                        time.sleep(1)
                    if debugpy.is_client_connected():
                        print("Debugger attached.")

                except KeyboardInterrupt:
                    print("Debugpy setup interrupted by user.")
                except Exception as e:
                    print(f"Warning: Could not configure debugpy with external interpreter: {e}")

    def _internalPlatformSetup(self):
        """
        Setup special platform requirements
        """

    def initializeServer(self):
        """
        Initializes the server, the PluginManager, the FlowManager
        the Settings and the RemoteManager
        """

        # Initialize only if not previously initialized
        if hasattr(self, "_server"):
            return

        # Start debugpy if needed
        # This is done here to ensure the AppDelegate is fully initialized
        # And has to be made before the init of the server in order
        # to debug plugin initialization (which happens during server init)
        self._loadDebugpy()

        # Prepare the server
        self._server = HorusServer(
            debug=self.debug,
            mode=self.mode,
            appSupportDir=self.appSupportDir,
            host=self.host,
            root=self.root,
            port=self.port,
        )

    def _loadLogger(self):
        """
        Starts a logger in production mode
        """

        self.logger = HorusLogger(self.appSupportDir, debug=self.debug, verbose=self.verbose)

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
            envPath = os.path.join(sys._MEIPASS, "APP_INFO")  # type: ignore
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
                    raise Exception("APPDATA environment variable not set")
            elif self.platform == "linux":
                appSupportDir = os.path.join(
                    os.path.expanduser("~"),
                    ".local",
                    "share",
                    appFolderName,
                )
            else:
                raise Exception(f"Unsupported platform {self.platform}")

        else:
            # If we are not in a frozen executable,
            # place the Application Support directory in the project directory
            # (Development)
            appSupportDir = os.path.join("AppSupport")

        # If a specific AppSupport directory was specified as an
        # environment variable, use that instead
        if os.getenv("HORUS_APP_SUPPORT_DIR") is not None:
            appSupportDir = str(os.getenv("HORUS_APP_SUPPORT_DIR"))

        appSupportDir = os.path.abspath(appSupportDir)

        if not os.path.exists(appSupportDir):
            os.makedirs(appSupportDir)

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
        for process in mp.active_children():  # type: ignore # pylint: disable=no-member
            process.terminate()

    def _menus(self):
        def newHorus():
            self.openWindow("Horus", forceNew=True)

        fileMenu = wm.Menu(
            "File",
            [
                wm.MenuAction(  # type: ignore
                    "New Window",
                    newHorus,
                ),
            ],
        )

        return [fileMenu]

    def _startAppMode(self):
        """
        This will start the window and set the shemsu token to the window object.
        """

        webview.settings["ALLOW_DOWNLOADS"] = True

        # Start the server in a new thread
        self._startServerThread()

        # Wait for the server to start
        # For unknown reasons, if this piece of code is not here
        # then the multiprocess module is not able to start new
        # flow processes to run the flows
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
            # windowOptions.on_top = True  # pylint: disable=invalid-name
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
        try:
            webview.start(debug=self.debug, menu=self._menus(), gui=guiBacked())  # type: ignore
        except webview.WebViewException:
            logging.getLogger("Horus").critical(
                "Failed to start the window management system. "
                "Try launching Horus in server mode (--server)"
            )

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
    def getPlatform() -> str:
        """
        Returns the platform of the app
        """

        # Get the platform
        currentPlatform = platform.platform().lower()
        if "macos" in currentPlatform:
            currentArch = platform.machine()
            currentPlatform = "macos_intel" if currentArch == "x86_64" else "macos_arm"
        elif "linux" in currentPlatform:
            currentPlatform = "linux"
        else:
            currentPlatform = "unknown"
            logging.warning("Unknown platform: %s", currentPlatform)

        return currentPlatform

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


def parseArgs() -> tuple[dict, dict, dict]:
    """
    Parse the arguments to the AppDelegate
    """

    debugReachable = not hasattr(sys, "frozen")

    class HorusParser(argparse.ArgumentParser):
        """
        Parser for the Horus app arguments
        """

        def error(self, message: str):
            self.print_help()
            args = {"prog": self.prog, "message": message}
            self.exit(2, ("\n%(prog)s: error: %(message)s\n") % args)

    parser = HorusParser(description="Launch options for Horus", add_help=False)
    parser.add_argument("-H", "--help", action="help", help="Show this help message and exit.")
    parser.add_argument("-v", "--version", action="store_true", help="Show the version and exit.")
    parser.add_argument(
        "-V",
        "--verbose",
        action="store_true",
        help="Verbose mode. Prints logs into the terminal.",
    )
    parser.add_argument(
        "--debug", "-d", action="store_true", help="Force the server to run in debug mode."
    )
    parser.add_argument(
        "--debug-plugins", "-dp", action="store_true", help="Attach a debugger to Horus."
    )
    parser.add_argument(
        "--password", help="Password for entering debug mode in the compiled app."
    )
    parser.add_argument(
        "--url",
        "-u",
        help="Debug URL. An URL to open instead of the default Horus interface. "
        "For development only.",
    )
    parser.add_argument("--app", "-a", action="store_true", help="Run in app mode.")
    parser.add_argument("--browser", "-b", action="store_true", help="Run in browser mode.")
    parser.add_argument("--server", "-s", action="store_true", help="Run in server mode.")
    parser.add_argument("--webapp", "-w", action="store_true", help="Run in webapp mode.")
    parser.add_argument(
        "--port",
        "-p",
        type=int,
        help="Set a specific port for the server. Defaults to a random port.",
    )
    parser.add_argument(
        "--host", "-h", help="Set a specific host for the server. Defaults to 'localhost'."
    )

    parser.add_argument(
        "--root",
        help="Set a specific base url path for the server. Defaults to '/'",
    )

    # Flow arguments
    parser.add_argument(
        "--flow",
        "-f",
        metavar="/path/to/flow",
        help="Run a flow instead of the app. Requires flow path and block index.",
    )

    parser.add_argument(
        "--index",
        "-i",
        metavar="placedID",
        type=int,
        help="Block placedID to run when the --flow option is provided.",
    )

    parser.add_argument(
        "--flow-base-url",
        metavar="URL",
        help="Base URL for sending events in a subprocess flow. "
        "Events will sent to the Horus server available on that instance."
        " Only intended for internal use.",
    )

    parser.add_argument(
        "--continue-slurm",
        action="store_true",
        help="Continue execution of the flow from a SLURM block that failed.",
    )

    parser.add_argument(
        "--reset-flow",
        action="store_true",
        help="Reset the entire flow before execution.",
    )

    parser.add_argument(
        "--reset-remote",
        action="store_true",
        help="Reset the remote block state before execution.",
    )

    parser.add_argument(
        "--flow-appsupport",
        metavar="/path/to/app/support/directory",
        help="Specify the path to the app support directory for the flow. "
        "Only intended for internal use. Do not specify this option unless"
        " you know what you are doing.",
    )

    # For installing a plugin from the command line
    parser.add_argument(
        "--install-plugin",
        metavar="/path/to/plugin",
        help="Install a plugin from the command line.",
        type=str,
    )

    parser.add_argument(
        "--as-default",
        action="store_true",
        help="Install the plugin in the default plugins folder.",
    )

    # Parse known arguments
    args, _ = parser.parse_known_args()

    # If the version flag was provided, print the version and exit
    if args.version:
        print(__version__)
        sys.exit(0)

    # If the password was provided along with the debug flag,
    # enter debug mode in production
    debugPassword = "horus_debug"
    if args.password and not debugReachable:
        # Check if the password is correct
        if args.password == debugPassword:
            print("Entering debug mode...")
            debugReachable = True

    # Check for the --debug flag (-d) (Only development and in production with password)
    # Forces the server to run in debug mode
    debug = False
    debugURL = None
    if args.debug and debugReachable:
        debug = True

        # Check for the --url (-u) flag
        if args.url:
            debugURL = args.url
            if debugURL is None or debugURL == "":
                print("No debug URL provided. Usage: -d -u <url>")
                sys.exit(1)

    # Parse the mode of the app
    mode: str = "app"  # Default mode is App / Desktop

    envMode = os.getenv("HORUS_MODE")
    # Determine mode
    if args.browser:
        mode = "browser"
    elif args.server:
        mode = "server"
    elif args.webapp:
        mode = "webapp"
    elif args.app:
        mode = "app"
    else:
        if envMode is not None:
            mode = envMode

    # Override the mode if install-plugin was provided
    mode = "server" if args.install_plugin else mode

    # Check for the --port (-p) flag to force a port on the app
    port = None
    envPort = os.getenv("HORUS_PORT")
    if args.port:
        port = args.port
        if port is None or port == "":
            print("No port provided. Usage: -p <port>")
            sys.exit(1)
        try:
            port = int(port)
        except ValueError:
            print("Invalid port provided. Usage: -p <integer>")
            sys.exit(1)
    elif envPort is not None:
        try:
            port = int(envPort)
        except ValueError:
            print("Invalid environment port provided. Usege: export HORUS_PORT=<integer>")
            sys.exit(1)

    # Check for the --host (-h) flag to force a host on the app
    host = None
    envHost = os.getenv("HORUS_HOST")
    if args.host:
        host = args.host
        if host is None or host == "":
            print("No host provided. Usage: -h <host>")
            sys.exit(1)
    elif envHost is not None:
        host = envHost

    # Check for the --root flag
    root = None
    envRoot = os.getenv("HORUS_ROOT")
    if args.root:
        root = args.root
        if root is None or root == "":
            print("No root provided. Usage: --root <root>")
            sys.exit(1)
    elif envRoot is not None:
        root = envRoot

    # Check for the --flow (-f) flag to run a flow instead of the app
    # The -f flag should be followed by the path to the flow and the
    # intex of the block to run -i <index>
    flowPath = None
    blockIndex = args.index
    if args.flow:
        flowPath = args.flow.strip()
        if not os.path.exists(flowPath):
            print(f"Flow '{flowPath}' does not exist")
            sys.exit(1)

        global FLOWPATH  # pylint: disable=global-statement
        FLOWPATH = flowPath

    flowAppSupport = (
        args.flow_appsupport.strip() if args.flow_appsupport else args.flow_appsupport
    )
    flowBaseURL = args.flow_base_url.strip() if args.flow_base_url else args.flow_base_url
    continueSlurm = args.continue_slurm
    resetFlow = args.reset_flow
    resetRemoteBlock = args.reset_remote

    # Parse debugpy
    debugPlugins = args.debug_plugins or os.getenv("HORUS_DEBUG_PLUGINS", "").lower() in (
        "1",
        "true",
        "yes",
    )

    # Parse the arguments
    argsDict = {
        "debug": debug,
        "mode": mode,
        "debugURL": debugURL,
        "host": host,
        "port": port,
        "root": root,
        "verbose": True if args.verbose else False,
        "debugPlugins": debugPlugins,
    }

    pluginArgs = {"installPlugin": args.install_plugin, "asDefault": args.as_default}

    flowArgs = {
        "flowPath": flowPath,
        "blockIndex": blockIndex,
        "flowAppSupport": flowAppSupport,
        "flowBaseURL": flowBaseURL,
        "continueSlurm": continueSlurm,
        "resetRemoteBlock": resetRemoteBlock,
        "resetFlow": resetFlow,
    }

    return argsDict, flowArgs, pluginArgs


def runFlowInsteadOfLaunch(app: AppDelegate, args: dict):
    """
    If a flow was provided as an argument, it will run the flow instead of launching the app.
    """

    flowPath = typing.cast(typing.Union[str, None], args.get("flowPath"))
    blockIndex = typing.cast(typing.Union[int, None], args.get("blockIndex"))
    baseURL = typing.cast(typing.Union[str, None], args.get("flowBaseURL"))
    continueSlurm = typing.cast(typing.Union[bool, None], args.get("continueSlurm"))
    resetFlow = typing.cast(typing.Union[bool, None], args.get("resetFlow"))
    resetRemoteBlock = typing.cast(typing.Union[bool, None], args.get("resetRemoteBlock"))
    flowAppSupport = typing.cast(typing.Union[str, None], args.get("flowAppSupport"))

    if flowPath is None:
        return

    if flowAppSupport:
        from Server.SettingsManager import SettingsManager

        settings = SettingsManager(flowAppSupport)
    else:
        settings = app.server.settingsManager

    # Open the flow
    flow = app.server.flowManager.openFlowFromPath(
        flowPath,
        addToRecents=False if flowAppSupport else True,
        socketBaseURL=baseURL,
        resetFlowSockets=True,
        checkState=False,
    )

    # Assign the settings instance. Using the flowAppSupport we ensure that in WebApp Mode
    # the user settings are used instead of the global settings
    flow.horusSettings = settings

    # Run the flow
    try:
        flow.run(
            placedID=blockIndex,
            resetRemoteBlock=resetRemoteBlock or False,
            resetFlow=resetFlow or False,
            continueSlurm=continueSlurm or False,
        )
    except Exception as error:
        flow.stop(fail=True, message=str(error))

    # Exit
    sys.exit(0)


def installPluginInsteadOfLaunch(app: AppDelegate, pluginArgs: dict):
    """
    If a plugin was provided as an argument,
    it will install the plugin instead of launching the app.
    """

    pluginPath = pluginArgs.get("installPlugin")
    if pluginPath:

        asDefault = pluginArgs.get("asDefault", False)

        app.server.pluginManager._loopPluginsToInstall([pluginPath], asDefault=asDefault)

        # Exit
        sys.exit(0)


def launchApp():
    """
    Launches the app.
    """

    appDelegateArgs, flowArgs, pluginArgs = parseArgs()

    # Prepare the app delegate
    app = AppDelegate(**appDelegateArgs)

    # Initialize the server
    try:
        app.initializeServer()
    except Exception as exc:
        import traceback

        logging.getLogger("Horus").critical(
            "Error initializing server: %s", traceback.format_exc() if app.debug else str(exc)
        )
        sys.exit(1)

    # If a plugin was provided as an argument, it will install
    # the plugin instead of launching the app.
    installPluginInsteadOfLaunch(app, pluginArgs)

    # If a flow was provided as an argument, it will run the flow instead of launching the app.
    runFlowInsteadOfLaunch(app, flowArgs)

    # Start the app
    try:
        # This is a blocking process.
        app.applicationDidFinishLaunching()

    except BaseException as exc:
        import traceback

        logging.getLogger("Horus").critical(
            "%s", traceback.format_exc() if app.debug else str(exc)
        )

        # Re-raise the exception, this is needed for flask auto-reload to work
        raise exc

    finally:
        # Execute after the app is terminated
        app.applicationWillTerminate()
