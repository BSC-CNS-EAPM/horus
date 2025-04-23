import threading
import os
import typing
import asyncio


# Define the SingletonMeta class for the AppDelegate and MolstarAPI classes
class SingletonMeta(type):
    """
    This is a thread-safe implementation of Singleton.

    Intened for internal use only.
    """

    _instances = {}
    _instance_locks = {}

    _lock: threading.Lock = threading.Lock()
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
        if cls.__name__ not in cls._instance_locks:
            cls._instance_locks[cls.__name__] = threading.Lock()

        lock_acquired = cls._instance_locks[cls.__name__].acquire(
            timeout=1
        )  # Wait for the lock for 1 second
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
            cls._instance_locks[cls.__name__].release()
            cls._lock_event.set()  # Notify the waiting threads that lock is released

        return cls._instances[cls]


class TempFile:
    """Temporary file class used to store temporary files in user dirs"""

    def __init__(self, name: str, folder: typing.Optional[str] = None):
        """
        - Name: The name of the file.
        - Folder: The folder where the file will be stored. If None, the file will bestored in the tmp folder.
        """
        if folder is None:
            folder = self._tmpDir()

        # Check if the user has as tmp folder, if not create it
        if not os.path.exists(folder):
            self._create_tmp_folder(folder)

        # Randomize the file name in order to prevent file clashes
        self.name = str(os.urandom(10).hex()) + name

        # Define the path of the tmp folder
        self.tmpFolder = folder

        # Define the path of the file
        self.path = os.path.join(self.tmpFolder, self.name)

        # Create the file
        self._create()

    def _tmpDir(self):
        # Assign the path of the tmp folder
        # to the current python working directory

        user_folder = getUserFolder()

        return os.path.join(user_folder, "tmp")

    def __repr__(self):
        return self.name

    def __str__(self):
        return self.path

    def __eq__(self, other):
        return self.path == other.path

    def __hash__(self):
        return hash(self.name + self.path)

    def __del__(self):
        # Delete the file
        self.delete()

        # If the tmp folder is empty, delete it
        if len(os.listdir(self.tmpFolder)) == 0:
            self.deleteTmpFolder()

    def _create_tmp_folder(self, folder: str):
        # Create a temporary folder
        tmp_folder = os.path.join(folder)
        os.mkdir(tmp_folder)

    def _create(self):
        # Create the file with the content of the string
        with open(self.path, "w") as f:
            f.write("")

    def delete(self):
        """
        Delete the file.
        """
        os.remove(self.path)

    def write(self, content: str):
        """
        Write content to the file

        - content: The content to write to the file.
        """
        with open(self.path, "w") as f:
            f.write(content)

    def read(self):
        """
        Read the content of the file

        :return: The content of the file as a string.
        """
        with open(self.path, "r") as f:
            return f.read()

    def deleteTmpFolder(self):
        """
        Deletes the tmp folder.
        """
        # Delete the tmp folder
        import shutil

        shutil.rmtree(self.tmpFolder)


def getUserFolder() -> str:
    # On WebApp mode, create the folder in the user's directory
    from App import AppDelegate

    if AppDelegate().server._isForUser:
        import flask_login  # type: ignore

        user = flask_login.current_user

        user_folder = user.appSupportDir
    else:
        user_folder = AppDelegate().appSupportDir

    return user_folder


class ResetRemoteException(Exception):
    """
    Exception raised when the remote server is reset.
    """


def initPlugin():
    """
    This function will create the basic folder structure for building
    a Horus plugin.
    """

    pluginID = input("Plugin ID. Must be unique: ")
    pluginName = input("Plugin name: ")
    description = input("Plugin description: ")
    pluginAuthor = input("Plugin author: ")
    version = input("Plugin version [0.0.1]: ") or "0.0.1"
    platforms = (
        input(
            "Plugin platforms. Allowed: universal, linux, macos_intel, macos_arm) separated by spaces. Default: universal: "
        )
        or "universal"
    )

    platforms = [platform.strip() for platform in platforms.split(" ")]

    externalURL = input("Plugin external URL (optional): ") or None

    pluginFolder = pluginName.replace(" ", "_")
    pluginFolder = pluginFolder.lower()

    # Create the plugin folder
    os.mkdir(pluginFolder)

    import HorusAPI

    pluginMeta = {
        "id": pluginID,
        "name": pluginName,
        "description": description,
        "author": pluginAuthor,
        "version": version,
        "minHorusVersion": HorusAPI.__version__,
        "platforms": platforms,
        "pluginFile": "plugin.py",
        "externalURL": externalURL,
        "dependencies": [],
    }

    # Validate the meta
    metaModel = HorusAPI.PluginMetaModel(**pluginMeta)

    # Inside the plugin folder, create the meta file
    with open(os.path.join(pluginFolder, "plugin.meta"), "w", encoding="utf-8") as f:
        # Dump the JSON meta file
        f.write(metaModel.json(indent=4))

    # Inside the plugin folder, create the plugin file
    with open(os.path.join(pluginFolder, "plugin.py"), "w", encoding="utf-8") as f:
        # Write the plugin file
        f.write("from HorusAPI import Plugin\n")
        f.write("\n")
        f.write("\n")
        f.write("plugin = Plugin()\n")

    # Create the Include folder inside the plugin folder
    os.mkdir(os.path.join(pluginFolder, "Include"))

    # Create the pages folder inside the plugin folder
    os.mkdir(os.path.join(pluginFolder, "Pages"))

    # Create a simple bash script to zip the plugin
    with open(os.path.join("build_plugin.sh"), "w", encoding="utf-8") as f:
        f.write("#!/bin/bash\n")
        f.write("\n")
        f.write('echo "Building plugin..."\n')
        f.write("\n")
        f.write(f"rm {pluginFolder}.hp\n")
        f.write("\n")
        f.write(f"zip -r {pluginFolder}.hp {pluginFolder}\n")

    print(f"Plugin {pluginName} created successfully!")
    print(
        "Visit https://horus.bsc.es/repo for instructions on how to upload your plugin to the public repository."
    )
