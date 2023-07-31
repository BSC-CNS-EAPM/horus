# Tools
import os
import sys
import hashlib

# Flask
import flask
from flask import request

# SocketIO
from flask_socketio import SocketIO, emit

# Decorators
from functools import wraps

# Import random to generate a random port number
import random

from HorusAPI import TempFile

# Define version
__version__ = "0.0.1"


class HorusServer:
    parcelURL = "http://127.0.0.1:1234"
    browser = False

    def __init__(self, debug=False, desktop=False, appSupportDir=None):
        # App support directory
        if appSupportDir is None:
            self.appSupportDir = os.path.abspath(os.path.join("AppSupport"))
        else:
            self.appSupportDir = appSupportDir

        # Desktop mode
        self.desktop = desktop

        # Basic Flask setup
        self.debug = debug
        self.host = "127.0.0.1"
        self.port = self._getFreePort()
        self.baseURL = f"http://{self.host}:{self.port}"

        # Initialize the plugin manager
        from Server import PluginManager

        self.pluginManager = PluginManager(self.appSupportDir, self.desktop)

        # Security token
        self.token = self._getToken()

        # Token manager
        self.tokenManager = TokenManager(self.token)

        # GUI directory
        self.guiDir = self._guiDir()

        # Setup the server
        self.server = self._setupServer()

        # Setup the regular routes
        self._routes()

        # Setup the favicons
        self._favicons()

        # Setup SocketIO
        self.socketio = SocketIO(
            self.server,
            cors_allowed_origins="*",
            async_mode=("threading" if self.debug else "eventlet"),
        )
        self._socketIORoutes()

        # Load the plugins pages
        self._pluginPages()

        # Load the debug endpoints
        if self.debug:
            self._debugRoutes()

        # Init MolstarAPI
        from HorusAPI import MolstarAPI

        self.molapi = MolstarAPI(self.socketio)

        self._molstarAPIRoutes()

        # Setup exception handlers
        self._exceptionHandlers()

    def _getToken(self):
        if self.desktop:
            try:
                import webview

                return webview.token
            except ImportError:
                raise Exception("Error: webview module not found")
            except AttributeError:
                raise Exception("Error: webview.token attribute not found")

        return str(random.randint(1, 100000000))

    def _getFreePort(self):
        # Generate a random port number
        port = random.randint(5001, 9000)

        if self.debug:
            return 5001

        if not self.desktop:
            return 8080

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
                if self.token is None or self.debug:
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
                    error = {
                        "ok": False,
                        "message": "This function is only available on desktop mode.",
                    }
                    return flask.jsonify(error)
                return func(*args, **kwargs)

            return wrapper

        # Setup the error page
        @self.server.errorhandler(404)
        def pageNotFound(e):
            return flask.render_template("Error/error.html")

        # Setup a template not found error

        @self.server.route("/proteo")
        def proteo():
            return flask.render_template("proteopedia-wrapper/index.html")

        @self.server.route("/error")
        def error():
            return flask.render_template("Error/error.html")

        @self.server.route("/saveflow", methods=["POST"])
        @verifyToken
        def createFlow():
            from .plugin_manager import OverwriteException

            flowData = request.get_json()
            try:
                flow = self.pluginManager.saveFlow(flowData)
                success = {
                    "ok": True,
                    "name": flow["name"],
                    "savedID": flow["savedID"],
                    "path": flow["path"],
                    "overwrite": False,
                }
            except OverwriteException as oe:
                success = {
                    "ok": True,
                    "existingName": oe.name,
                    "path": oe.path,
                    "overwrite": True,
                    "desktop": self.desktop,
                }
            except Exception as e:
                success = {
                    "ok": False,
                    "error": str(e),
                }
            return flask.jsonify(success)

        @self.server.route("/openflow", methods=["GET"])
        @verifyToken
        def openFlow():
            try:
                flow = self.pluginManager.openFlow()
                success = {"ok": True, "flow": flow}
            except Exception as e:
                success = {
                    "ok": False,
                    "error": str(e),
                }
            return flask.jsonify(success)

        @self.server.route("/desktop/isDesktop", methods=["GET"])
        def isDesktop():
            return flask.jsonify(self.desktop)

        @self.server.route("/plugins/", methods=["GET"])
        @desktopOnly
        def pluginsManager():
            return flask.render_template("PluginsManager/index.html", shemsu=self.token)

        @self.server.route("/plugins/install", methods=["GET"])
        @desktopOnly
        def installPlugin():
            try:
                self.pluginManager.installPlugin(self.socketio)
                success = {
                    "ok": True,
                }
            except Exception as e:
                success = {
                    "ok": False,
                    "message": str(e),
                }
            return flask.jsonify(success)

        @self.server.route("/plugins/uninstall", methods=["POST"])
        @desktopOnly
        def uninstallPlugin():
            data = request.get_json()
            pluginName = data.get("name", None)
            if pluginName is None:
                success = {
                    "ok": False,
                    "message": "Plugin name not provided.",
                }
            try:
                self.pluginManager.uninstallPlugin(pluginName)
                success = {
                    "ok": True,
                }
            except Exception as e:
                success = {
                    "ok": False,
                    "message": str(e),
                }
            return success

        @self.server.route("/desktop/appsupportdir", methods=["GET"])
        @desktopOnly
        def openPluginsFolder():
            from App import AppDelegate

            AppDelegate().openAppSupportDir()
            return "OK"

        @self.server.route("/plugins/list", methods=["GET"])
        @verifyToken
        def listPlugins():
            plugins = self.pluginManager.getPlugins()
            return flask.jsonify(plugins)

        @self.server.route("/plugins/listblocks", methods=["GET"])
        @verifyToken
        def listblocks():
            plugins = self.pluginManager.getBlocks()
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
            # Execute the action from a given block
            try:
                variables = data["variables"]
                blockID = data["blockID"]
                workingDir = data["path"]
                inputs = data["inputs"]
                outputs = self.pluginManager.executeBlock(
                    blockID, variables, inputs, workingDir, self.socketio
                )
                success = {
                    "ok": True,
                    "outputs": outputs,
                }
                return flask.jsonify(success)
            except Exception as e:
                self.socketio.emit("printTerm", str(e))
                error = {
                    "ok": False,
                    "error": str(e),
                }
                return flask.jsonify(error)

        @self.server.route("/plugins/config", methods=["POST"])
        @verifyToken
        def pluginConfig():
            data = request.get_json()
            # Save the config
            try:
                output = self.pluginManager.saveConfig(data)
                self.socketio.emit("printTerm", output)
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

        @self.server.route("/desktop/command", methods=["POST", "GET"])
        @desktopOnly
        def executeCommand():
            data = request.get_json()
            from App import AppDelegate

            try:
                AppDelegate().executeCommand(data["command"], self.socketio)
                return {"ok": True}
            except Exception as e:
                return {
                    "ok": False,
                    "error": str(e),
                }

        @self.server.route("/desktop/openWindow", methods=["POST"])
        @desktopOnly
        def openWindow():
            name = request.get_json()["name"]
            url = request.get_json()["url"]
            fullURL = f"{self.baseURL}/{url}"
            from App import AppDelegate

            AppDelegate().openWindow(name, fullURL)
            return "OK"

        @self.server.route("/bmode", methods=["GET"])
        @desktopOnly
        def bmode():
            return flask.render_template("BrowserMode/index.html")

        @self.server.route("/getbrowserurl", methods=["GET"])
        @desktopOnly
        @verifyToken
        def getBrowserURL():
            return flask.jsonify({"url": self.baseURL})

        @self.server.route("/openbmode", methods=["GET"])
        @desktopOnly
        @verifyToken
        def openBrowserMode():
            from App import AppDelegate

            AppDelegate().openBrowserMode()
            return "OK"

        @self.server.route("/openfolder", methods=["GET"])
        @verifyToken
        def openFolder():
            if self.desktop:
                from App import AppDelegate

                selFolder = AppDelegate().openFolderSelectDialog()
            else:  # Implement folder picker for web/server mode
                print("WARNING: Folder picker not implemented for web/server mode")
                selFolder = "/example/path"

            return flask.jsonify({"path": selFolder})

        @self.server.route("/openfile", methods=["GET"])
        @verifyToken
        def openFile():
            if self.desktop:
                from App import AppDelegate

                selFile = AppDelegate().openFileSelectDialog()
            else:
                print("WARNING: File picker not implemented for web/server mode")
                selFile = "/Users/cdominguez/Downloads/KRAS/input.yaml"

            return flask.jsonify({"path": selFile})

        @self.server.route("/savecontents", methods=["POST"])
        @verifyToken
        def saveFile():
            # Get from the request the data to save
            data = request.get_json()

            contents = data.get("contents", None)
            filename = data.get("filename", "File")

            if contents is None:
                return flask.jsonify({"ok": False, "msg": "No data to save"})

            if self.desktop:
                # Select the path where to save the file
                from App import AppDelegate

                selFile = AppDelegate().saveFileSelectDialog(filename)

                # If the user cancelled the dialog, return
                if selFile is None:
                    return flask.jsonify({"ok": False, "msg": "User cancelled"})

                # Save the file
                with open(selFile, "w") as f:
                    f.write(contents)

                return flask.jsonify({"ok": True})
            else:
                # If we are in server mode, download the file
                tmpFile = TempFile(filename)
                tmpFile.write(contents)
                return flask.send_file(
                    tmpFile.path,
                    as_attachment=True,
                    download_name="protein.pdb",
                    mimetype="application/octet-stream",
                )

        @self.server.route("/remotes", methods=["GET"])
        @desktopOnly
        def remotes():
            return flask.render_template("Remotes/index.html")

        @self.server.route("/remotes/list", methods=["GET"])
        @desktopOnly
        def listRemotes():
            from App import AppDelegate

            return flask.jsonify(AppDelegate().listRemotes())

        @self.server.route("/remotes/names", methods=["GET"])
        @verifyToken
        def listRemoteNames():
            try:
                from App import AppDelegate

                remotes = AppDelegate().listRemotes()

                remotes = [r["name"] for r in remotes]

                # Append the local machine if there are remotes
                if len(remotes) > 0:
                    remotes.append("Local")

                success = {
                    "ok": True,
                    "remotes": remotes,
                }
            except Exception as e:
                success = {
                    "ok": False,
                    "msg": str(e),
                }
            return flask.jsonify(success)

        @self.server.route("/remotes/configure", methods=["POST"])
        @desktopOnly
        def configureRemote():
            data = request.get_json()

            if data is None:
                return flask.jsonify({"ok": False, "msg": "No data to save"})

            try:
                from App import AppDelegate

                AppDelegate().configureRemote(data)
                return flask.jsonify({"ok": True})
            except Exception as e:
                return flask.jsonify({"ok": False, "msg": str(e)})

        @self.server.route("/remotes/delete", methods=["POST"])
        @desktopOnly
        def deleteRemote():
            data = request.get_json()

            nameToDelete = data.get("name", None)

            if data is None or nameToDelete is None:
                return flask.jsonify({"ok": False, "msg": "Missing data"})

            try:
                from App import AppDelegate

                AppDelegate().deleteRemote(nameToDelete)
                return flask.jsonify({"ok": True})
            except Exception as e:
                return flask.jsonify({"ok": False, "msg": str(e)})

        @self.server.route("/remotes/connect", methods=["POST"])
        @desktopOnly
        def connectRemote():
            data = request.get_json()

            remote = data.get("remote", None)

            if data is None or remote is None:
                return flask.jsonify({"ok": False, "msg": "Missing data"})

            try:
                from App import AppDelegate

                AppDelegate().connectRemote(remote)
                return flask.jsonify({"ok": True})
            except Exception as e:
                return flask.jsonify({"ok": False, "msg": str(e)})

        @self.server.route("/remotes/command", methods=["POST"])
        @desktopOnly
        def remoteCommand():
            data = request.get_json()
            if data is None:
                return flask.jsonify({"ok": False, "msg": "Missing data"})

            remote = data.get("remote", None)
            command = data.get("command", None)

            if remote is None or command is None:
                return flask.jsonify({"ok": False, "msg": "Missing command or remote"})

            try:
                from App import AppDelegate

                out = AppDelegate().remote.command(command)
                return flask.jsonify({"ok": True, "output": str(out)})
            except Exception as e:
                return flask.jsonify({"ok": False, "msg": str(e)})

        @self.server.route("/")
        def index():
            # Get the query string
            shemsu = request.args.get("shemsu", None)

            if shemsu is not None:
                import webview

                if shemsu == webview.token:
                    # Starting server in browser mode
                    return flask.render_template("Main/index.html", shemsu=shemsu)

            return flask.render_template("Main/index.html")

        @self.server.after_request
        def addHeader(response):
            # Disable caching
            response.headers["Cache-Control"] = "no-store"
            return response

    def _molstarAPIRoutes(self):
        @self.server.route("/loadPDB", methods=["POST"])
        def loadPDB():
            # Loads the pdb file into mol*, this is a bridge for MolstarAPI
            data = request.get_json()

            pdb = data.get("pdb", None)

            if pdb is None:
                return flask.jsonify({"ok": False, "msg": "No data to load"})

            self.socketio.emit("loadPDB", data)

            return flask.jsonify({"ok": True})

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

        pages = self.pluginManager.getPagesObject()

        for page in pages:
            htmlPath = page._pageInfo["html"]
            url = f"/plugins/pages/{page._pageInfo['id']}/"

            def createBlueprint(htmlPath, url):
                # Create a blueprint for the page
                bp = flask.Blueprint(
                    page._pageInfo["id"].replace(".", "_"),
                    __name__,
                    template_folder=os.path.dirname(htmlPath),
                    static_folder=os.path.dirname(htmlPath),
                    static_url_path=url,
                )

                # Create a route for the html
                @bp.route(url)
                def send_html():
                    return flask.render_template(os.path.basename(htmlPath))

                # Create a route for the static files
                @bp.route(url + "<path:filename>")
                def send_static(filename):
                    return flask.send_from_directory(
                        os.path.dirname(htmlPath), filename
                    )

                # Add the required endpoints
                for ep in page.endpoints:
                    # Verify that the enpoint url does not with a /
                    # It will be added by the url
                    if ep.url.startswith("/"):
                        ep_url = url + ep.url[1:]
                    else:
                        ep_url = url + ep.url

                    # Create the endpoint
                    bp.add_url_rule(
                        ep_url,
                        view_func=ep.function,
                        methods=ep.methods,
                    )

                return bp

            # Call the function with the current htmlPath
            bp = createBlueprint(htmlPath, url)

            # Register the blueprint
            try:
                self.server.register_blueprint(bp)
            except Exception as e:
                e = (
                    "\033[91mError registering page for plugin "
                    + page.id
                    + ": "
                    + str(e)
                    + "\033[0m"
                )
                print(e)
                self.socketio.emit("printTerm", e)

    def _debugRoutes(self):
        @self.server.route("/reloadplugins", methods=["GET"])
        def realoadPlugins():
            # Reload the plugin manager
            self.pluginManager.reloadPlugins()

            # Reload the plugin pages
            self._pluginPages()

            return "Reloaded"

    def _exceptionHandlers(self):
        @self.server.errorhandler(Exception)
        def exceptionHandler(e: Exception):
            # Get the full traceback as string
            import traceback

            tb = traceback.format_exc()

            # Print the traceback to the terminal
            print(tb)

            return flask.render_template("Error/error.html", errormsg=str(tb))

    def _favicons(self):
        @self.server.route("/favicon.ico")
        def favicon():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "favicon.ico",
                mimetype="image/vnd.microsoft.icon",
            )

        @self.server.route("/apple-touch-icon.png")
        def apple_touch_icon():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "apple-touch-icon.png",
                mimetype="image/png",
            )

        @self.server.route("/favicon-32x32.png")
        def favicon_32x32():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "favicon-32x32.png",
                mimetype="image/png",
            )

        @self.server.route("/favicon-16x16.png")
        def favicon_16x16():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "favicon-16x16.png",
                mimetype="image/png",
            )

        @self.server.route("/site.webmanifest")
        def site_webmanifest():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "site.webmanifest",
                mimetype="application/manifest+json",
            )

        @self.server.route("/safari-pinned-tab.svg")
        def safari_pinned_tab():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "safari-pinned-tab.svg",
                mimetype="image/svg+xml",
            )

    def run(self, reloader: bool = False):
        # use_reloader has to be turned off in order to run in a secondary thread

        if not self.desktop:
            print("Running server mode at: http://" + self.host + ":" + str(self.port))

        # Start the server
        self.socketio.run(
            self.server,
            host=self.host,
            port=self.port,
            debug=self.debug,
            use_reloader=reloader,
        )


class TokenManager:
    """
    Tokenize strings, paths...
    """

    salt = "shemsu"
    """
    A random generated number each time the server is started
    """

    def __init__(self, salt: str) -> None:
        self.salt = salt

    def tokenize(self, string: str) -> str:
        """
        Generates a token for the string given
        Returns the token
        """
        # Add the salt to the string
        salted_string = string + self.salt

        # Encode the salted string as bytes
        salted_bytes = salted_string.encode("utf-8")

        # Hash the bytes using the SHA-256 algorithm
        hash_object = hashlib.sha256(salted_bytes)

        # Convert the resulting hash to a hexadecimal string
        token = hash_object.hexdigest()

        return token

    def checkToken(self, token: str, string: str) -> bool:
        """
        Verifies if a given token corresponds with the given string
        """
        return token == self.tokenize(string)
