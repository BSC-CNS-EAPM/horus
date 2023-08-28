# pylint: disable=too-many-lines
"""
The HorusServer module
"""

# Tools
import os
import sys
import hashlib

# Decorators
from functools import wraps

# Import random to generate a random port number
import random

# Socket for checking available ports
import socket

# Flask
import flask
from flask import request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

# Requests
import requests

# Webview
import webview

# Utilities
from HorusAPI import TempFile

# Flow manager
from Server.FlowManager import FlowManager, Flow, OverwriteException

# Settings manager
from Server.SettingsManager import SettingsManager

# Remotes manager
from Server.RemotesManager import RemotesManager

# Plugin manager
from Server.PluginManager import PluginManager


class HorusServer:
    """
    The Horus server class. The server always runs in the background, even when the
    application is in desktop mode. This is because the server is used to communicate
    between the frontend and the python backed.
    """

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
        self.pluginManager = PluginManager(self.appSupportDir, self.desktop)
        """
        The plugin manager class. Handle plugin installation, loading and block execution.
        """

        # Initialize the Remotes Manager
        self.remoteManager = RemotesManager(self.appSupportDir)
        """
        Remote manager class. Handle remote connections, configurations and commands.
        """

        # Initialize the settings manager
        self.settingsManager = SettingsManager(self.appSupportDir)
        """
        Settings manager class. Handle the app settings.
        """

        # Initialize the flow manager
        self.flowManager = FlowManager(self.appSupportDir)
        """
        FlowManager class. Handle saving and opening of flows.
        """

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
            cors_allowed_origins="*" if self.debug else self.baseURL,
            async_mode="threading" if self.debug else "eventlet",
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
                return webview.token
            except ImportError as impe:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "Error: webview module not found"
                ) from impe
            except AttributeError as attre:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "Error: webview.token attribute not found"
                ) from attre

        return str(random.randint(1, 100000000))

    def _getFreePort(self):
        # Generate a random port number
        port = random.randint(5001, 9000)

        if self.debug:
            return 5001

        if not self.desktop:
            return 8080

        # Check that the port is not in use
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
        try:
            requests.get(self.parcelURL, timeout=0.5)
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
            return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))

        # Development path
        guiDir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "GUI"))

        # Frozen executable path
        if not os.path.exists(guiDir):
            try:
                bundleDir = sys._MEIPASS  # type: ignore pylint: disable=protected-access
                guiDir = os.path.abspath(os.path.join(bundleDir, "GUI"))
            except AttributeError as attre:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "App not frozen and GUI directory not found."
                    + " Did you forget to build the View?"
                ) from attre

        return guiDir

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
            CORS(server, resources={r"/*": {"origins": "*"}})

        return server

    def _routes(self):
        # Create a wrapper for token verification
        def verifyToken(func):
            # @wraps(func)
            # def wrapper(*args, **kwargs):
            #     if self.token is None or self.debug:
            #         return func(*args, **kwargs)
            #     if request.headers.get("shemsu") == self.token:
            #         return func(*args, **kwargs)
            #     return flask.redirect("/error")

            # return wrapper

            # ====DISABLE IT FOR NOW ====
            return func

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
        def pageNotFound(error):
            return flask.render_template("Error/error.html", errormsg=str(error))

        # Setup a template not found error

        @self.server.route("/error")
        def error():
            return flask.render_template("Error/error.html")

        @self.server.route("/saveflow", methods=["POST"])
        @verifyToken
        def createFlow():
            flowData = request.get_json()
            try:
                flow = self.flowManager.saveFlow(flowData)
                success = {
                    "ok": True,
                    "name": flow.name,
                    "savedID": flow.savedID,
                    "path": flow.path,
                    "overwrite": False,
                }
            except OverwriteException as ovexc:
                success = {
                    "ok": True,
                    "existingName": ovexc.name,
                    "path": ovexc.path,
                    "overwrite": True,
                    "desktop": self.desktop,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "error": str(exc),
                }
            print("Returning saveflow request")
            return flask.jsonify(success)

        @self.server.route("/openflow", methods=["GET"])
        @verifyToken
        def openFlow():
            try:
                if self.desktop:
                    flow = self.flowManager.openFlow()
                else:
                    raise Exception(  # pylint: disable=broad-exception-raised
                        "This function is only available on desktop mode."
                    )
                success = {"ok": True, "flow": flow.encode(minimal=False)}
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "error": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/recentFlows", methods=["GET"])
        @verifyToken
        def recentFlows():
            try:
                flows = self.flowManager.listRecentFlows()
                # Convert the flows to JSON
                flows = [flow.encode() for flow in flows]

                success = {"ok": True, "flows": flows}
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "error": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/cleanRecents", methods=["GET"])
        @verifyToken
        def cleanRecents():
            try:
                self.flowManager.cleanRecentFlows()
                success = {"ok": True}
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "error": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/openRecentFlow", methods=["POST"])
        @verifyToken
        def openRecentflow():
            try:
                data = request.get_json()
                if data is None:
                    raise Exception("No data provided")  # pylint: disable=broad-exception-raised
                savedID = data.get("savedID", None)
                path = data.get("path", None)
                if path is not None:
                    flow = self.flowManager.openFlowFromPath(path)
                else:
                    if savedID is None:
                        raise Exception(  # pylint: disable=broad-exception-raised
                            "No savedID provided"
                        )
                    flow = self.flowManager.loadPredefinedFlow(savedID)
                success = {
                    "ok": True,
                    "flow": flow.encode(minimal=False),
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "error": str(exc),
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
                self.socketio.emit("pluginChanges")
                success = {
                    "ok": True,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "message": str(exc),
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
                self.socketio.emit("pluginChanges")
                success = {
                    "ok": True,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "message": str(exc),
                }
            return success

        @self.server.route("/desktop/appsupportdir", methods=["GET"])
        @desktopOnly
        def openPluginsFolder():
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

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
        def executeBlock():
            print("Recived request to execute block")
            data = request.get_json()
            # Execute the action from a given block
            try:
                variables = data["variables"]
                blockID = data["blockID"]
                workingDir = data["path"]
                inputs = data["inputs"]
                flowSavedID = data["flowSavedID"]
                blockPlacedID = data["blockPlacedID"]
                resetRemote = data.get("resetRemote", False)
                outputs = self.pluginManager.executeBlock(
                    blockID,
                    blockPlacedID,
                    variables,
                    inputs,
                    workingDir,
                    flowSavedID,
                    self.socketio,
                    resetRemoteBlock=resetRemote,
                )
                success = {
                    "ok": True,
                    "outputs": outputs,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                errorMSG = str(exc).strip()
                self.socketio.emit("printTerm", errorMSG)
                success = {
                    "ok": False,
                    "error": errorMSG,
                }
            print("Returning executeblock request")
            return flask.jsonify(success)

        @self.server.route("/plugins/checkRemoteBlock", methods=["POST"])
        @verifyToken
        def checkRemoteBlock():
            # Check if the remote block is still running
            data = request.get_json()

            flowSavedID = data.get("flowSavedID", None)
            blockPlacedID = data.get("blockPlacedID", None)

            try:
                remote = self.remoteManager.remote
                if remote is None:
                    raise Exception(  # pylint: disable=broad-exception-raised
                        "Could not check remote block. No remote connected"
                    )

                status = remote.getRemoteBlockStatus(flowSavedID, blockPlacedID)

                success = {
                    "ok": True,
                    "status": status,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "error": str(exc),
                }

            return flask.jsonify(success)

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
            except Exception as exc:  # pylint: disable=broad-exception-caught
                error = {
                    "ok": False,
                    "error": str(exc),
                }
                return flask.jsonify(error)

        @self.server.route("/plugins/flows", methods=["GET"])
        @verifyToken
        def listFlows():
            try:
                flows = self.pluginManager.listFlows()
                # Remove the paths
                for flow in flows:
                    flow.pop("path", None)
                success = {
                    "ok": True,
                    "flows": flows,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "error": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/desktop/command", methods=["POST", "GET"])
        @desktopOnly
        def executeCommand():
            data = request.get_json()
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            try:
                AppDelegate().executeCommand(data["command"], self.socketio)
                return {"ok": True}
            except Exception as exc:  # pylint: disable=broad-exception-caught
                return {
                    "ok": False,
                    "error": str(exc),
                }

        @self.server.route("/desktop/openWindow", methods=["POST"])
        @desktopOnly
        def openWindow():
            name = request.get_json()["name"]
            url = request.get_json()["url"]
            fullURL = f"{self.baseURL}/{url}"
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

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
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            AppDelegate().openBrowserMode()
            return "OK"

        @self.server.route("/about", methods=["GET"])
        @verifyToken
        def about():
            return flask.render_template("About/index.html", shemsu=self.token)

        @self.server.route("/about/version", methods=["GET"])
        @verifyToken
        def version():
            try:
                from App import AppDelegate  # pylint: disable=import-outside-toplevel

                version = AppDelegate().APP_INFO["APP_VERSION"]
                success = {
                    "ok": True,
                    "version": version,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/openfolder", methods=["GET"])
        @verifyToken
        def openFolder():
            if self.desktop:
                from App import AppDelegate  # pylint: disable=import-outside-toplevel

                selFolder = AppDelegate().openFolderSelectDialog()
            else:  # Implement folder picker for web/server mode
                print("WARNING: Folder picker not implemented for web/server mode")
                selFolder = "/example/path"

            return flask.jsonify({"path": selFolder})

        @self.server.route("/openfile", methods=["GET"])
        @verifyToken
        def openFile():
            if self.desktop:
                from App import AppDelegate  # pylint: disable=import-outside-toplevel

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
                from App import AppDelegate  # pylint: disable=import-outside-toplevel

                selFile = AppDelegate().saveFileSelectDialog(filename)

                # If the user cancelled the dialog, return
                if selFile is None:
                    return flask.jsonify({"ok": False, "msg": "User cancelled"})

                # Save the file
                with open(selFile, "w", encoding="utf-8") as file:
                    file.write(contents)

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
            return flask.jsonify(self.remoteManager.listRemotes())

        @self.server.route("/remotes/names", methods=["GET"])
        @verifyToken
        def listRemoteNames():
            try:
                remotes = self.remoteManager.listRemotes()

                remotes = [r["name"] for r in remotes]

                # Append the local machine if there are remotes
                if len(remotes) > 0:
                    remotes.append("Local")

                success = {
                    "ok": True,
                    "remotes": remotes,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/remotes/configure", methods=["POST"])
        @desktopOnly
        def configureRemote():
            data = request.get_json()

            if data is None:
                return flask.jsonify({"ok": False, "msg": "No data to save"})

            try:
                self.remoteManager.configureRemote(data)
                return flask.jsonify({"ok": True})
            except Exception as exc:  # pylint: disable=broad-exception-caught
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/remotes/delete", methods=["POST"])
        @desktopOnly
        def deleteRemote():
            data = request.get_json()

            nameToDelete = data.get("name", None)

            if data is None or nameToDelete is None:
                return flask.jsonify({"ok": False, "msg": "Missing data"})

            try:
                self.remoteManager.deleteRemote(nameToDelete)
                return flask.jsonify({"ok": True})
            except Exception as exc:  # pylint: disable=broad-exception-caught
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/remotes/connect", methods=["POST"])
        @desktopOnly
        def connectRemote():
            data = request.get_json()

            remote = data.get("remote", None)

            if data is None or remote is None:
                return flask.jsonify({"ok": False, "msg": "Missing data"})

            try:
                self.remoteManager.connectRemote(remote)
                return flask.jsonify({"ok": True})
            except Exception as exc:  # pylint: disable=broad-exception-caught
                return flask.jsonify({"ok": False, "msg": str(exc)})

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
                remote = self.remoteManager.remote
                if remote is None:
                    raise Exception(  # pylint: disable=broad-exception-raised
                        "Could not perform command. No remote connected."
                    )
                out = remote.command(command)
                return flask.jsonify({"ok": True, "output": str(out)})
            except Exception as exc:  # pylint: disable=broad-exception-caught
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/remotes/update", methods=["POST"])
        @desktopOnly
        def updateRemote():
            data = request.get_json()
            if data is None:
                return flask.jsonify({"ok": False, "msg": "Missing data"})

            savedFlowID = data.get("savedFlowID", None)
            if savedFlowID is None:
                return flask.jsonify({"ok": False, "msg": "Missing savedFlowID"})

            try:
                remote = self.remoteManager.remote

                if remote is None:
                    raise Exception(  # pylint: disable=broad-exception-raised
                        "Could not update remote. No remote connected."
                    )

                queue = remote.updateQueue(savedFlowID)

                success = {
                    "ok": True,
                    "queue": queue,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/settings")
        @desktopOnly
        def settings():
            settings = self.settingsManager.listSettings()

            return flask.jsonify({"ok": True, "settings": settings})
            # return flask.render_template("Settings/index.html")

        @self.server.route("/")
        def index():
            # Get the query string
            shemsu = request.args.get("shemsu", None)

            if shemsu is not None:
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
        def handleMessage(data):
            print("received message: " + data)
            emit("printTerm", "Hello from the server!")

    def _pluginPages(self):
        """
        Setup the plugin pages
        """

        # Create a wrapper function to add to
        # python path the plugin deps folder
        def viewFunctionWrapper(func, page, endPoint):
            @wraps(func)
            def wrapper(*args, **kwargs):
                sys.path.append(page._pageInfo["deps"])  # pylint: disable=protected-access
                result = endPoint.function(*args, **kwargs)
                sys.path.remove(page._pageInfo["deps"])  # pylint: disable=protected-access
                return result

            return wrapper

        pages = self.pluginManager.getPagesObject()

        for page in pages:
            htmlPath = page._pageInfo["html"]  # pylint: disable=protected-access
            url = f"/plugins/pages/{page._pageInfo['id']}/"  # pylint: disable=protected-access

            def createBlueprint(page, htmlPath, url):
                # Create a blueprint for the page
                newBluePrint = flask.Blueprint(
                    page._pageInfo["id"].replace(".", "_"),  # pylint: disable=protected-access
                    __name__,
                    template_folder=os.path.dirname(htmlPath),
                    static_folder=os.path.dirname(htmlPath),
                    static_url_path=url,
                )

                # Create a route for the html
                @newBluePrint.route(url)
                def sendHtml():
                    return flask.render_template(os.path.basename(htmlPath))

                # Create a route for the static files
                @newBluePrint.route(url + "<path:filename>")
                def sendStatic(filename):
                    return flask.send_from_directory(os.path.dirname(htmlPath), filename)

                # Add the required endpoints
                for addEndPoint in page.endpoints:
                    # Verify that the enpoint url does not with a /
                    # It will be added by the url
                    if addEndPoint.url.startswith("/"):
                        epURL = url + addEndPoint.url[1:]
                    else:
                        epURL = url + addEndPoint.url

                    # Create the endpoint
                    newBluePrint.add_url_rule(
                        epURL,
                        view_func=viewFunctionWrapper(addEndPoint.function, page, addEndPoint),
                        methods=addEndPoint.methods,
                    )

                return newBluePrint

            # Call the function with the current htmlPath
            parsedBluePrint = createBlueprint(page, htmlPath, url)

            # Register the blueprint
            try:
                self.server.register_blueprint(parsedBluePrint)
            except Exception as exc:  # pylint: disable=broad-exception-caught
                errorMSG = (
                    "\033[91mError registering page for plugin "
                    + page.id
                    + ": "
                    + str(exc)
                    + "\033[0m"
                )
                print(errorMSG)
                self.socketio.emit("printTerm", errorMSG)

    def _debugRoutes(self):
        @self.server.route("/reloadplugins", methods=["GET"])
        def realoadPlugins():
            # Reload the plugin manager
            self.pluginManager.reloadPlugins()

            # Reload the plugin pages
            self._pluginPages()

            return "Reloaded"

    def _exceptionHandlers(self):
        pass
        # @self.server.errorhandler(Exception)
        # def exceptionHandler(e: Exception):
        #     # Get the full traceback as string
        #     import traceback

        #     tb = traceback.format_exc()

        #     # Print the traceback to the terminal
        #     print(tb)

        #     return flask.render_template("Error/error.html", errormsg=str(tb))

    def _favicons(self):
        @self.server.route("/favicon.ico")
        def favicon():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "favicon.ico",
                mimetype="image/vnd.microsoft.icon",
            )

        @self.server.route("/apple-touch-icon.png")
        def appleTouchIcon():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "apple-touch-icon.png",
                mimetype="image/png",
            )

        @self.server.route("/favicon-32x32.png")
        def favicon32x32():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "favicon-32x32.png",
                mimetype="image/png",
            )

        @self.server.route("/favicon-16x16.png")
        def favicon16x16():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "favicon-16x16.png",
                mimetype="image/png",
            )

        @self.server.route("/site.webmanifest")
        def siteWebmanifest():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "site.webmanifest",
                mimetype="application/manifest+json",
            )

        @self.server.route("/safari-pinned-tab.svg")
        def safariPinnedTab():
            return flask.send_from_directory(
                os.path.join(self.guiDir, "Favicon"),
                "safari-pinned-tab.svg",
                mimetype="image/svg+xml",
            )

    def run(self, reloader: bool = False):
        """
        Runs the server using the socketio.run method
        """
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
        saltedString = string + self.salt

        # Encode the salted string as bytes
        saltedBytes = saltedString.encode("utf-8")

        # Hash the bytes using the SHA-256 algorithm
        hashObject = hashlib.sha256(saltedBytes)

        # Convert the resulting hash to a hexadecimal string
        token = hashObject.hexdigest()

        return token

    def checkToken(self, token: str, string: str) -> bool:
        """
        Verifies if a given token corresponds with the given string
        """
        return token == self.tokenize(string)
