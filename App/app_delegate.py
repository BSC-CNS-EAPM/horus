import sys
import os
import webview
from threading import Lock

# Import type annotations
import typing

from Server import HorusServer

import cython

# Add to the pythonpath the path of the project
sys.path.append("../")

# Create a global dictionary to store information about the app
# such as the version, the bundle identifier, etc.
appInfo = {"version": "0.0.1", "bundleIdentifier": "com.nostrumbiodiscovery.horus"}


class SingletonMeta(type):
    """
    This is a thread-safe implementation of Singleton.
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


class AppDelegate(metaclass=SingletonMeta):
    windows = []
    """
    All of the windows that are currently open
    """

    def __init__(self, debug=False):
        """
        Initialize the AppDelegate.
        This will start the backend server and create the first window.
        """
        self.debug = debug

        # Set the app support directory
        self.__appSupportDir()

        # Prepare the server
        self.server: HorusServer = HorusServer(
            debug=self.debug, desktop=True, appSupportDir=self.appSupportDir
        )

        # Start the server in a new thread
        self.__startServer()

    def __appSupportDir(self):

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

    def __startServer(self):
        """
        Starts the backend Flask server.
        This server will handle python modules and scripts in our app.
        """
        import threading

        self.server_thread = threading.Thread(target=self.server.run)
        self.server_thread.daemon = True
        self.server_thread.start()

    def openWindow(self, title: str, url: typing.Optional[str] = None):
        """
        Creates a new window with the given title.
        If no url is given, the index page will be loaded.

        :param title: The title of the window
        :param url: The url to load
        """
        if url is None:
            url = self.server.baseURL
        window = webview.create_window(title, url=url)
        self.windows.append(window)
        return window

    def applicationDidFinishLaunching(self):
        """
        This will be called when the app is launched. 
        It will create the first window and launch the app
        """
        self.openWindow("Horus")
        self.__start()

    def applicationWillTerminate(self):
        """
        This will be called after the last window is closed.
        """
        pass

    def __menus(self):
        import webview.menu as wm

        def newHorus():
            self.openWindow("Horus")

        def openPlugins():
            self.openWindow("Plugins", url=self.server.baseURL + "/plugins")

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

    def __start(self):
        """
        This will start the window and set the shemsu token to the window object.
        """
        webview.start(debug=self.debug, menu=self.__menus())

    def openFileDialog(
        self,
        allowMultiple: bool = False,
        fileTypes: typing.Optional[typing.Tuple[str, ...]] = None,
    ):
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


def LaunchApp():

    # Set the debug mode based on module compilation
    debug: bool = not cython.compiled

    # Check for the --server flag (Only development)
    if "--server" in sys.argv:
        # Start the server
        from Server.server import HorusServer

        server = HorusServer(debug=True, desktop=False)
        server.run(reloader=True)

        # Exit the app
        sys.exit(0)

    # Check for the --no-debug flag (Only development)
    if "--no-debug" in sys.argv:
        debug = False    

    # Prepare the app delegate
    app = AppDelegate(debug)
    """
    App Delegate is a singleton class that will handle the app
    """

    # Start the app. This is a blocking process.
    app.applicationDidFinishLaunching()

    # Execute after the app is terminated
    app.applicationWillTerminate()
