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

import cython

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
        with cls._lock:
            # The first thread to acquire the lock, reaches this conditional,
            # goes inside and creates the Singleton instance. Once it leaves the
            # lock block, a thread that might have been waiting for the lock
            # release may then enter this section. But since the Singleton field
            # is already initialized, the thread won't create a new object.
            if cls not in cls._instances:
                instance = super().__call__(*args, **kwargs)
                cls._instances[cls] = instance
        return cls._instances[cls]


# Add to the pythonpath the path of the project
sys.path.append("../")

# Create a global dictionary to store information about the app
# such as the version, the bundle identifier, etc.
appInfo = {"version": "0.0.1", "bundleIdentifier": "com.nostrumbiodiscovery.horus"}


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


class AppDelegate(metaclass=SingletonMeta):
    windows = []
    """
    All of the windows that are currently open
    """

    def __init__(
        self, debug: bool = False, server_mode: bool = False, browser: bool = False
    ):
        """
        Initialize the AppDelegate.
        This will start the backend server and create the first window.
        """
        self.debug = debug
        self.server_mode = server_mode
        self.browser = browser

        # Set the app support directory
        self._appSupportDir()

        # Prepare the server
        self.server: HorusServer = HorusServer(
            debug=self.debug, desktop=not server_mode, appSupportDir=self.appSupportDir
        )

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
                    appInfo["bundleIdentifier"],
                )
            elif self.platform == "win32":
                appSupportDir = os.getenv("APPDATA")
                if appSupportDir is not None:
                    appSupportDir = os.path.join(
                        appSupportDir, appInfo["bundleIdentifier"]
                    )
                else:
                    raise Exception("APPDATA environment variable not set")
            elif self.platform == "linux":
                appSupportDir = os.path.join(
                    os.path.expanduser("~"),
                    ".local",
                    "share",
                    appInfo["bundleIdentifier"],
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
    ):
        """
        Creates a new window with the given title.
        If no url is given, the index page will be loaded.

        :param title: The title of the window
        :param url: The url to load
        """

        # If no url is given, load the index page
        if url is None:
            url = self.server.baseURL

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
        self.windows.append(window)

        # Return the window
        return window

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
            self.openWindow("Horus")

        def openPlugins():
            pluginsURL = self.server.baseURL + "/plugins/"
            pluginsURL = self.tokenize(pluginsURL)
            self.openWindow("Plugins", url=pluginsURL)

        fileMenu = wm.Menu(
            "File",
            [
                wm.MenuAction("New...", None),
                wm.MenuAction("Open...", None),
                wm.MenuAction("Save project...", None),
                wm.MenuSeparator(),
                wm.MenuAction(
                    "New Window",
                    newHorus,
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

        def openSSHConfig():
            self.openWindow(
                "SSH Config", url=self.server.baseURL + "/desktop/configureSSH"
            )

        settingsMenu = wm.Menu(
            "Settings",
            [
                wm.MenuAction("SSH configuration", openSSHConfig),
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

        if isinstance(result, tuple):
            result = "".join(result)

        return result

    @staticmethod
    def tokenize(url: str):
        """
        Adds to an url the shemsu as a query parameter.
        """
        return f"{url}?shemsu={webview.token}"

    def configureSSH(self, sshConfig: dict):
        """
        Configures the SSH connection for HPC clusters

        param sshConfig: A dictionary containing the ssh configuration
        {
            user: str,
            host: str,
            port: int,
            keys: str,
        }
        """

        import json

        user_data = {
            "user": sshConfig["user"],
            "host": sshConfig["host"],
            "port": sshConfig["port"],
            "dir": sshConfig["dir"],
        }

        with open(f"{self.appSupportDir}/ssh.json", "w") as f:
            json.dump(user_data, f)

        with open(f"{self.appSupportDir}/ssh.key", "w") as f:
            f.write(sshConfig["keys"])

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


def LaunchApp():
    # Check for the --debug flag (-d) (Only development)
    # Forces the server to run in debug mode
    debug = False
    if ("--debug" in sys.argv or "-d" in sys.argv) and not cython.compiled:
        debug = True

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
    app = AppDelegate(debug, server_mode, browser)
    """
    App Delegate is a singleton class that will handle the app
    """

    # Start the app. This is a blocking process.
    app.applicationDidFinishLaunching()

    # Execute after the app is terminated
    app.applicationWillTerminate()
