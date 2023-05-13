import sys
import os
import webview
from threading import Lock

from Server import HorusServer

import cython

# Add to the pythonpath the path of the project
sys.path.append("../")


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

    def __init__(self):
        """
        Initialize the AppDelegate. 
        This will start the backend server and create the first window.
        """
        # Set the debug mode based on module compilation
        self.debug: bool = not cython.compiled

        # Check if the app is frozen
        self.frozen = self.__isFrozen()

        # Create the plugins folder
        self.__createPluginsFolder()

        # Prepare the server
        self.server: HorusServer = HorusServer(debug=self.debug)

        # Start the server in a new thread
        self.__startServer()

    def __isFrozen(self):
        """
        Returns wheter the app is frozen or not
        """
        try: 
            sys._MEIPASS
            return True
        except AttributeError: 
            return False

    def __createPluginsFolder(self):
        """
        Creates the plugins folder
        """
        # Get the plugins folder path
        if self.frozen:
            pluginsFolder = os.path.join(sys._MEIPASS, "Plugins")
        else:
            pluginsFolder = os.path.join("Plugins")

        # Create the plugins folder
        if not os.path.exists(pluginsFolder):
            os.mkdir(pluginsFolder)

        # Set the plugins folder
        self.pluginsFolder = os.path.abspath(pluginsFolder)

    def __startServer(self):
        """
        Starts the backend Flask server. 
        This server will handle python modules and scripts in our app.
        """
        import threading

        self.server_thread = threading.Thread(target=self.server.run)
        self.server_thread.daemon = True
        self.server_thread.start()

    def newWindow(self, title: str, url: str = None):
        """
        Creates a new window with the given title. 
        If no url is given, the index page will be loaded.

        :param title: The title of the window
        :param url: The url to load
        """
        if url is None:
            url = self.server.baseURL
        window = webview.create_window("Horus", url=url)
        return window

    def applicationDidFinishLaunching(self):
        """
        This will be called when the app is launched. It will create the first window.
        """
        self.__start(self.newWindow("Horus"))

    def applicationWillTerminate(self):
        """
        This will be called after the last window is closed.
        """
        pass

    def __setShemsuToken(self, window):
        """
        This will be called when the window is ready.
        It will set the shemsu token to the window.
        """
        window.evaluate_js(f"window.shemsu = '{webview.token}';")

    def __start(self, window):
        """
        This will start the window and set the shemsu token to the window object.
        """
        webview.start(self.__setShemsuToken, window, debug=self.debug)

    @staticmethod
    def tokenize(url: str):
        """
        Adds to an url the shemsu as a query parameter.
        """
        return f"{url}?shemsu={webview.token}"
    
    @staticmethod
    def installPlugin(pluginPath: str):
        """
        Installs a plugin to the plugins dir
        """
        import shutil
        shutil.copy(pluginPath, AppDelegate().pluginsFolder)

    @staticmethod
    def uninstallPlugin(pluginName: str):
        """
        Uninstalls a plugin from the plugins dir
        """
        import os
        os.remove(f"{AppDelegate().pluginsFolder}/{pluginName}")

    @staticmethod
    def getPlugins():
        """
        Returns a list of all the plugins in the plugins dir
        """
        import os
        return os.listdir(AppDelegate().pluginsFolder)


def LaunchApp():

    # Define a global variable "isDesktop" that will be used to check if the app is 
    # running on desktop mode
    global isDesktop
    isDesktop = True

    # Prepare the app delegate
    global app
    app = AppDelegate()
    """
    App Delegate is a singleton class that will handle the app
    """

    # Start the app. This is a blocking process.
    app.applicationDidFinishLaunching()

    # Execute after the app is terminated
    app.applicationWillTerminate()
