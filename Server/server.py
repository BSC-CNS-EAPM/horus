# Tools
import os
import sys

# Flask
import flask
from flask import request

# SocketIO
from flask_socketio import SocketIO, emit

# Decorators
from functools import wraps

# Import random to generate a random port number
import random

# Import time to wait for the debug port to be free
import time

# Define version
__version__ = "0.0.1"


class HorusServer:
    parcelURL = "http://127.0.0.1:1234"

    def __init__(self, debug=False, desktop=False, appSupportDir=None):
        # App support directory
        if appSupportDir is None:
            self.appSupportDir = os.path.abspath(os.path.join("AppSupport"))
        else:
            self.appSupportDir = appSupportDir

        # Basic Flask setup
        self.debug = debug
        self.host = "127.0.0.1"
        self.port = self._getFreePort()
        self.baseURL = f"http://{self.host}:{self.port}"

        # Desktop mode
        self.desktop = desktop

        # Initialize the plugin manager
        from Server import PluginManager

        self.pluginManager = PluginManager(self.appSupportDir, self.desktop)

        # Security token
        self.token = self._getToken()

        # GUI directory
        self.guiDir = self._guiDir()

        # Setup the server
        self.server = self._setupServer()
        self._routes()

        # Setup SocketIO
        self.socketio = SocketIO(
            self.server,
            cors_allowed_origins="*",
            async_mode=("threading" if self.debug else "eventlet"),
        )
        self._socketIORoutes()

        # Load the plugins pages
        self._pluginPages()

    def _getToken(self):
        if self.desktop:
            import webview

            return webview.token
        else:
            return None

    def _getFreePort(self):
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

    def _checkParcel(self):
        # If the parcel server is running, load the index file from there:
        import requests

        try:
            requests.get(self.parcelURL)
            print("\n<=======Using parcel development server=======>\n")
            return True
        except requests.exceptions.ConnectionError:
            return False

    def _guiDir(self):
        """
        Checks for the GUI directory
        """

        # Check if the parcel server is running
        if self.debug and self._checkParcel():
            return os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "dist")
            )

        # Development path
        gui_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "GUI"))

        # Frozen executable path
        if not os.path.exists(gui_dir):
            try:
                bundle_dir = sys._MEIPASS  # type: ignore
                gui_dir = os.path.abspath(os.path.join(bundle_dir, "GUI"))
            except AttributeError:
                raise Exception(
                    "App not frozen and GUI directory not found."
                    + " Did you forget to build the View?"
                )

        return gui_dir

    def _setupServer(self):
        """
        Creates the Flask server instance. This will serve the GUI files and handle the
        API requests. Also disables Flask logging when not in debug mode.
        """
        # Disable werkzeug logging when not in debug mode
        # logging.getLogger("werkzeug").disabled = not self.debug

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

            CORS(server, resources={r"/*": {"origins": "*"}})

        return server

    def _routes(self):
        # Create a wrapper for token verification
        def verifyToken(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                if self.token is None:
                    return func(*args, **kwargs)
                if request.headers.get("shemsu") == self.token:
                    return func(*args, **kwargs)
                return flask.redirect("/error")

            return wrapper

        # Create a wrapper for checking if the app is on desktop mode or web mode
        def desktopOnly(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                if not self.desktop and not self.debug:
                    return flask.redirect("/error")
                return func(*args, **kwargs)

            return wrapper

        # Setup the error page
        @self.server.errorhandler(404)
        def pageNotFound(e):
            return flask.redirect("/")

        @self.server.route("/error")
        def error():
            return flask.render_template("Error/error.html")

        @self.server.route("/createflow", methods=["POST"])
        @verifyToken
        def createFlow():
            flowData = request.get_json()
            try:
                self.pluginManager.createFlow(flowData["name"])
                success = {
                    "ok": True,
                }
                return flask.jsonify(success)
            except Exception as e:
                error = {
                    "ok": False,
                    "error": str(e),
                }
                return flask.jsonify(error)

        @self.server.route("/desktop/isDesktop", methods=["GET"])
        def isDesktop():
            return flask.jsonify(self.desktop)

        @self.server.route("/plugins/", methods=["GET", "POST"])
        @desktopOnly
        def pluginsManager():
            return flask.render_template("PluginsManager/index.html")

        @self.server.route("/plugins/install", methods=["GET"])
        @desktopOnly
        def installPlugin():
            try:
                self.pluginManager.installPlugin()
            except Exception as e:
                error = {
                    "error": str(e),
                }
                return flask.jsonify(error)
            return "OK"

        @self.server.route("/plugins/uninstall", methods=["POST"])
        @desktopOnly
        def uninstallPlugin():
            pluginName = request.get_json()["name"]
            self.pluginManager.uninstallPlugin(pluginName)
            return "OK"

        @self.server.route("/desktop/appsupportdir", methods=["GET"])
        @desktopOnly
        def openPluginsFolder():
            print("Opening plugins folder")
            from App import AppDelegate

            AppDelegate().openAppSupportDir()
            return "OK"

        @self.server.route("/plugins/list", methods=["GET"])
        @verifyToken
        def listPlugins():
            plugins = self.pluginManager.listLoaded()
            return flask.jsonify(plugins)

        @self.server.route("/plugins/listblocks", methods=["GET"])
        @verifyToken
        def listblocks():
            plugins = self.pluginManager.listAllBlocks()
            return flask.jsonify(plugins)

        @self.server.route("/plugins/listpages", methods=["GET"])
        @verifyToken
        def listpages():
            pages = self.pluginManager.getPages()
            return flask.jsonify(pages)

        @self.server.route("/plugins/executeblock", methods=["POST"])
        @verifyToken
        def pluginAction():
            data = request.get_json()

            variables = data["variables"]
            blockID = data["blockID"]

            # Execute the action from a given block
            try:
                output = self.pluginManager.executeBlock(blockID, variables)
                self.socketio.emit("printTerm", output)
                success = {
                    "ok": True,
                }
                return flask.jsonify(success)
            except Exception as e:
                print(e)
                error = {
                    "ok": False,
                    "error": str(e),
                }
                return flask.jsonify(error)

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

            return "OK"

        @self.server.route("/")
        def index():
            return flask.render_template("Main/index.html")

        @self.server.after_request
        def addHeader(response):
            # Disable caching
            response.headers["Cache-Control"] = "no-store"
            return response

    def _socketIORoutes(self):
        """
        Setup the socket.io routes endpoints
        """

        @self.socketio.on("message")
        def handle_message(data):
            print("received message: " + data)
            emit("printTerm", "Hello from the server!")

    def _pluginPages(self):
        """
        Setup the plugin pages
        """

        pages = self.pluginManager.getPages()

        for page in pages:
            htmlPath = page["html"]
            url = f"/plugins/pages/{page['id']}/"

            # Create a blueprint for the page
            blueprint = flask.Blueprint(
                page["id"].replace(".", "_"),
                __name__,
                template_folder=os.path.dirname(htmlPath),
                static_folder=os.path.dirname(htmlPath),
                static_url_path=url,
            )

            # Add the route to return the html file
            @blueprint.route(url)
            def send_html():
                return flask.render_template(os.path.basename(htmlPath))

            # Register the blueprint
            try:
                self.server.register_blueprint(blueprint)
            except Exception as e:
                e = "Error registering page for plugin " + page["id"] + ": " + str(e)
                self.socketio.emit("printTerm", e)

    def run(self, reloader=False):
        # use_reloader has to be turned off in order to run in a secondary thread
        self.socketio.run(
            self.server,
            host=self.host,
            port=self.port,
            debug=self.debug,
            use_reloader=reloader,
        )
