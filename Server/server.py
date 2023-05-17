# Tools
import os
import sys
import logging

# Flask
import flask
from flask import request

# Decorators
from functools import wraps

# Import random to generate a random port number
import random

# Define version
__version__ = "0.0.1"


class HorusServer:
    parcelURL = "http://127.0.0.1:1234"

    def __init__(self, debug=False, desktop=False):
        # Basic Flask setup
        self.debug = debug
        self.host = "127.0.0.1"
        self.port = self.__getFreePort()
        self.baseURL = f"http://{self.host}:{self.port}"

        # Desktop mode
        self.desktop = desktop

        # Initialize the plugin manager
        self.pluginManager = PluginManager()

        # Security token
        self.token = self.__cors()

        # GUI directory
        self.guiDir = self.__guiDir()

        # Setup the server
        self.server = self.__setupServer()
        self.__routes()

    def __cors(self):
        if self.desktop:
            import webview

            return webview.token
        else:
            return None

    def __getFreePort(self):
        # Generate a random port number
        port = random.randint(5001, 9000)

        if self.debug:
            port = 5001

        # Check that the port is not in use
        import socket

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        while True:
            try:
                sock.bind((self.host, port))
                break
            except OSError:
                port = random.randint(5001, 9000)

        return port

    def __checkParcel(self):
        # If the parcel server is running, load the index file from there:
        import requests

        try:
            requests.get(self.parcelURL)
            print("\n<=======Using parcel development server=======>\n")
            return True
        except requests.exceptions.ConnectionError:
            return False

    def __guiDir(self):
        """
        Checks for the GUI directory in the following order:
        1. The parent directory of the current file (development)
        2. The parent directory of the current file (frozen executable pyinstaller)
        3. The current directory (frozen executable py2app)
        """

        # Check if the parcel server is running
        if self.__checkParcel():
            return os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "dist")
            )

        # Development path
        gui_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "GUI"))

        # Frozen executable path
        if not os.path.exists(gui_dir):
            try:
                bundle_dir = sys._MEIPASS
                gui_dir = os.path.abspath(os.path.join(bundle_dir, "GUI"))
            except AttributeError:
                raise Exception(
                    "App not frozen and GUI directory not found. Did you forget to run npm run buildparcel?"
                )

        return gui_dir

    def __setupServer(self):
        """
        Creates the Flask server instance. This will serve the GUI files and handle the
        API requests. Also disables Flask logging when not in debug mode.
        """
        # Disable werkzeug logging when not in debug mode
        logging.getLogger("werkzeug").disabled = not self.debug

        # Setup the server
        server = flask.Flask(
            __name__,
            static_folder=self.guiDir,
            template_folder=self.guiDir,
            static_url_path="/",
        )

        if self.debug:
            print("\n<========Enabling CORS========>\n")
            from flask_cors import CORS

            CORS(server)

        return server

    def __routes(self):
        # Create a wrapper for checking if the app is on desktop mode or web mode
        def desktopOnly(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                if not self.desktop:
                    return flask.redirect("/error")
                return func(*args, **kwargs)

            return wrapper

        # Setup the error page
        @self.server.errorhandler(404)
        def pageNotFound(e):
            return flask.redirect("/error")

        @self.server.route("/error")
        def error():
            return flask.render_template("Error/error.html")

        @self.server.route("/api/version", methods=["GET"])
        def sendVersion():
            import nbdsuite as nbds

            versionInfo = {
                "nbdsuite": nbds.__version__,
                "horus": __version__,
            }
            return flask.jsonify(versionInfo)

        @self.server.route("/api/nbdsuite/forcefields", methods=["GET"])
        def sendForcefields():
            from nbdsuite.utils.toolkits import PeleffyToolkit

            peleffy_tk = PeleffyToolkit()
            ff_list = peleffy_tk.get_available_forcefields()
            return flask.jsonify(ff_list)

        @self.server.route("/desktop/isDesktop", methods=["GET"])
        def isDesktop():
            return flask.jsonify(self.desktop)

        @self.server.route("/desktop/plugins", methods=["GET"])
        @desktopOnly
        def pluginsManager():
            return flask.render_template("PluginsManager/index.html")

        @self.server.route("/desktop/plugins/install", methods=["GET"])
        @desktopOnly
        def installPlugin():
            from App import AppDelegate
            AppDelegate().installPlugin()
            return "OK"

        @self.server.route("/desktop/plugins/list", methods=["GET"])
        def listPlugins():
            plugins = self.pluginManager.listPlugins()
            return flask.jsonify(plugins)

        @self.server.route("/desktop/openWindow", methods=["POST"])
        @desktopOnly
        def openWindow():
            name = request.get_json()["name"]
            url = request.get_json()["url"]
            fullURL = f"{self.baseURL}/{url}"
            from App import AppDelegate

            AppDelegate().openWindow(name, fullURL)
            return "OK"

        @self.server.route("/desktop/configureSSH", methods=["GET", "POST"])
        @desktopOnly
        def configureSSH():
            # If the method was GET, return the SSH config page
            if request.method == "GET":
                return flask.render_template("SSHAgent/SSHConfig.html")

            # If it was POST, save the SSH config
            if request.method == "POST":
                from App import AppDelegate

                AppDelegate().configureSSH(request.get_json())
                return "OK"

        @self.server.route("/")
        def index():
            return flask.render_template("Main/index.html")

        if not self.debug:

            @self.server.before_request
            def beforeRequest():
                # Check the token only for the api routes
                if (
                    request.path.startswith("/api")
                    and (request.args.get("shemsu") or request.headers.get("shemsu"))
                    != self.token
                ):
                    return flask.redirect("/error")

        @self.server.after_request
        def addHeader(response):
            # Disable caching
            response.headers["Cache-Control"] = "no-store"
            return response

    def run(self):
        self.server.run(
            host=self.host, port=self.port, debug=self.debug, use_reloader=False
        )


class PluginManager:
    """
    This class manages the installation, loading and uninstallation of plugins.
    It creates the AppSupport/Plugins directory if it doesn't exist.
    """

    loadedPlugins = []

    def __init__(self) -> None:
        self.appSupportDir = self.__appSupportDir()
        self.pluginsDir = self.__pluginsDir()

        # Initialize the plugins
        self.__initializePlugins()

        print("Loaded plugins:")
        for p in self.loadedPlugins:
            print(f" - {p.pluginInfo['name']}")

    def __pluginsDir(self):
        pluginsDir = os.path.join(self.appSupportDir, "Plugins")

        if not os.path.exists(pluginsDir):
            os.mkdir(pluginsDir)

        return pluginsDir

    def __appSupportDir(self):
        try:
            appSupportDir = os.path.join(sys._MEIPASS, "AppSupport")
        except AttributeError:
            appSupportDir = os.path.join("AppSupport")

        appSupportDir = os.path.abspath(appSupportDir)

        if not os.path.exists(appSupportDir):
            os.mkdir(appSupportDir)

        return appSupportDir

    def installPlugin(self, pluginPath: str):
        """
        Installs a plugin from the given path.
        """
        import shutil

        shutil.copy(pluginPath, self.pluginsDir)

    def uninstallPlugin(self, pluginName: str):
        """
        Uninstalls a plugin with the given name.
        """
        import os

        pluginPath = os.path.join(self.pluginsDir, pluginName)
        os.remove(pluginPath)

    def __listPluginsPaths(self):
        """
        Lists the plugins present in the plugins directory.
        """
        # List the files present in the plugins directory
        pluginFiles = os.listdir(self.pluginsDir)

        # Filter the python files
        plugins = []
        for pf in pluginFiles:
            if pf.endswith(".py"):
                fullPath = os.path.abspath(os.path.join(self.pluginsDir, pf))
                plugins.append(fullPath)

        return plugins

    def __initializePlugins(self):
        """
        Initializes all the plugins present in the plugins directory.
        """
        pluginPaths = self.__listPluginsPaths()
        for pth in pluginPaths:
            try:
                self.__loadPlugin(pth)
            except Exception as e:
                print(f"Error loading plugin {os.path.basename(pth)}: {e}")

    def __loadPlugin(self, pluginPath: str):
        """
        Loads a plugin from the given path.
        """

        import imp
        from Server.HorusPlugin import Plugin

        fileName = os.path.basename(pluginPath)

        # Load the plugin file and obtain the plugin variable
        pluginFile = imp.load_source("pluginFile", pluginPath)

        # Check that the plugin variable exists
        if not hasattr(pluginFile, "plugin"):
            raise Exception(
                f"The plugin {fileName} does not contain a plugin variable."
            )

        plugin = pluginFile.plugin

        # Check that the plugin variable is a Plugin instance
        if not isinstance(plugin, Plugin):
            raise Exception(
                f"The plugin {fileName} does not contain a valid plugin variable."
            )

        # Check that the plugin variable has a name
        if not plugin.pluginInfo["name"]:
            raise Exception(f"The plugin {fileName} does not have a name.")

        # Add the plugin to the loaded plugins list only if it is not already there
        if plugin not in self.loadedPlugins:
            self.loadedPlugins.append(plugin)
        else:
            raise Exception(
                f"Another plugin with the same name as {plugin.pluginInfo['name']}"
                + "is already loaded."
            )

    def listPlugins(self):
        """
        Returns a list of all the loaded plugins.
        """
        listedPlugins = []
        for p in self.loadedPlugins:
            info = p.pluginInfo
            info["actions"] = len(p.pluginActions)
            listedPlugins.append(info)
        return listedPlugins
