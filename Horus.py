import sys
import webview
from threading import Lock

from Server import HorusServer

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

    def __init__(self, debug=False):
        self.server = HorusServer(debug=debug)
        self.debug = debug
        self.__startServer()

    def __startServer(self):
        # Creates a secondary thread to run the server
        import threading

        self.server_thread = threading.Thread(target=self.server.run)
        self.server_thread.setDaemon(True)
        self.server_thread.start()

    def newWindow(self, title):
        window = webview.create_window(
            "Horus",
            url=self.server.url,
        )
        return window

    def applicationDidFinishLaunching(self):
        self.__start(self.newWindow("Horus"))

    def applicationWillTerminate(self):
        pass

    def __setShemsuToken(self, window):
        result = window.evaluate_js(f"window.shemsu = '{webview.token}'")
        print("Token: ", result)

    def __start(self, window):
        webview.start(self.__setShemsuToken, window, debug=self.debug)


if __name__ == "__main__":
    # Prepare the app delegate
    app = AppDelegate(debug=True)

    # Start the app
    app.applicationDidFinishLaunching()

    # Terminate the app
    app.applicationWillTerminate()
