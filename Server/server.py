# pylint: disable=too-many-lines
"""
The HorusServer module
"""

# Tools
import os
import sys
import hashlib
import logging
import typing

# Decorators
from functools import wraps

# Import random to generate a random port number
import random

# Socket for checking available ports
import socket

# Ctyhon
import cython

# Multiprocess module, a fork of multiprocessing with enhancements
from multiprocess import Process  # type: ignore pylint: disable=no-name-in-module
import multiprocess.process as mp

# Flask
import flask
import jinja2
from flask import Flask, request
from flask_socketio import SocketIO, join_room, leave_room
from flask_cors import CORS
from flask_session import Session

# Requests
import requests

# Webview
import webview

# Utilities
from HorusAPI import TempFile

# Flow manager
from Server.FlowManager import FlowManager, OverwriteException

# Settings manager
from Server.SettingsManager import SettingsManager

# Remotes manager
from Server.RemotesManager import RemotesManager

# Plugin manager
from Server.PluginManager import PluginManager

# Server explorer
from Server.FileExplorer import FileExplorer


class HorusServer:
    """
    The Horus server class. The server always runs in the background, even when the
    application is in desktop mode. This is because the server is used to communicate
    between the frontend and the python backed.
    """

    parcelURL = "http://127.0.0.1:3001"
    browser = False

    def __init__(
        self,
        debug=False,
        desktop=False,
        appSupportDir=None,
        host=None,
        port=None,
        safeMode=False,
    ):
        # App support directory
        if appSupportDir is None:
            self.appSupportDir = os.path.abspath(os.path.join("AppSupport"))
        else:
            self.appSupportDir = appSupportDir

        # Desktop mode
        self.desktop = desktop

        # Secure mode
        self.safeMode = safeMode

        # Basic Flask setup
        self.debug = debug
        self.host = host if host else "localhost"
        self.port = port if port else self._getFreePort()
        self.baseURL = f"http://{self.host}:{self.port}"

        # If we are running on host 0.0.0.0, get the real base URL
        localIp = None
        if self.host == "0.0.0.0":
            localIp = socket.gethostbyname(socket.gethostname())
            self.baseURL = f"http://{localIp}:{self.port}"

        # Check that the baseURL is not in use
        if not self.debug:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                sock.bind((localIp or self.host, self.port))
            except OSError as ose:
                logging.getLogger("Horus").error(
                    "Address %s is already in use. %s", self.baseURL, str(ose)
                )
                print(f"Address {self.baseURL} is already in use")
                raise Exception(  # pylint: disable=broad-exception-raised
                    f"Adress {self.baseURL} is already in use"
                ) from ose

        logging.getLogger("Horus").info("Host: %s", self.host)
        logging.getLogger("Horus").info("Port: %s", self.port)
        logging.getLogger("Horus").info("BaseURL: %s", self.baseURL)

        # Initialize the settings manager
        self.settingsManager = SettingsManager(self.appSupportDir)
        """
        Settings manager class. Handle the app settings.
        """

        # Initialize the plugin manager
        self.pluginManager = PluginManager(self.appSupportDir)
        """
        The plugin manager class. Handle plugin installation, loading and block execution.
        """

        # Initialize the Remotes Manager
        self.remoteManager = RemotesManager(self.appSupportDir)
        """
        Remote manager class. Handle remote connections, configurations and commands.
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
        self._setupSocketio()

        # Load the plugins pages
        self._pluginPages()

        # Load the debug endpoints
        if self.debug:
            self._debugRoutes()

        # Init ExtensionsAPI
        from HorusAPI import Extensions

        self.extensionsAPI = Extensions(self.socketio)

        # Setup exception handlers
        self._exceptionHandlers()

        # Setup Flask-Session
        self._startSession()

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
        port = random.randint(3000, 9000)

        if self.debug:
            return 3000

        # Check that the port is not in use
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        while True:
            try:
                sock.bind((self.host, port))
                break
            except OSError:
                port = random.randint(3000, 9000)

        return port

    def _checkParcel(self):
        # If the parcel server is running, load the index file from there:
        try:
            requests.get(self.parcelURL, timeout=0.5)
            logging.getLogger("Horus").debug("Using Parcel development server")
            return True
        except requests.exceptions.ConnectionError:
            return False
        except requests.exceptions.ReadTimeout as rete:
            logging.getLogger("Horus").debug("Could not verify parcel address %s", self.parcelURL)
            logging.getLogger("Horus").debug("Error: %s", str(rete))
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
            logging.getLogger("Horus").debug("Enabling CORS")
            CORS(server, resources={r"/*": {"origins": "*"}}, origins="*")

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
            # @wraps(func)
            # def wrapper(*args, **kwargs):
            #     if self.safeMode and not self.debug:
            #         error = {
            #             "ok": False,
            #             "message": "This function is only available on desktop mode.",
            #         }
            #         logging.getLogger("Horus").error(error["message"])
            #         return flask.jsonify(error)
            #     return func(*args, **kwargs)

            # return wrapper

            # ====DISABLE IT FOR NOW ====
            return func

        # API routes

        @self.server.route("/api/saveflow", methods=["POST"])
        @verifyToken
        def saveFlow():

            # The client here sends a form data with two values:
            # - flowData: The flow data as a JSON string (contains flow name, placed blocks...)
            # - molstarState: The molstar state as a zip file

            # Parse the request data
            request.get_data()
            data = request.form
            files = request.files

            if data is None or files is None:
                success = {
                    "ok": False,
                    "error": "No data provided",
                }

                return flask.jsonify(success)

            # Get the flow data and the molstar state
            flowData = data.get("flowData", None)

            if flowData is None:
                success = {
                    "ok": False,
                    "error": "No flowData provided",
                }

                return flask.jsonify(success)

            # Parse the data string as JSON
            flowData = flask.json.loads(flowData)

            # Get the molstar state
            molstarState = files.get("molstarState", None)

            # Read the bytes of the state
            if molstarState is not None:
                molstarState = molstarState.stream.read()

            try:
                flow = self.flowManager.saveFlow(flowData, molstarState)

                # Emit the saved flow to connected rooms
                self.socketio.emit("flow", flow.encode(minimal=False), to=flow.savedID)

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
            return flask.jsonify(success)

        @self.server.route("/api/openflow", methods=["GET"])
        @verifyToken
        def openFlow():
            try:
                if self.desktop:
                    flow = self.flowManager.openFlow(socket=self.socketio)
                else:
                    raise Exception(  # pylint: disable=broad-exception-raised
                        "This function is only available on desktop mode."
                    )

                # Get the flow JSON
                flowJson = flow.encode(minimal=False)

                # Get the molstarStte zip file
                molstarState = flow.getMolstarState()

                success = {"ok": True, "flow": flowJson}
                if molstarState is not None:
                    # Convert the molstar state to a hex string
                    molstarState = molstarState.hex()

                    success["molstarState"] = molstarState

                # Return both the flow and the molstar state as binary
                # to be later retrieved by the client as a blob
                return flask.jsonify(success)

            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "error": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/api/recentflows", methods=["GET"])
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

        @self.server.route("/api/cleanrecents", methods=["GET"])
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

        @self.server.route("/api/openrecentflow", methods=["POST"])
        @verifyToken
        def openRecentflow():
            try:
                data = request.get_json()
                if data is None:
                    raise Exception("No data provided")  # pylint: disable=broad-exception-raised
                savedID = data.get("savedID", None)
                path = data.get("path", None)
                if path is not None:
                    # Load the flow from the path
                    flow = self.flowManager.openFlowFromPath(path, socket=self.socketio)
                else:
                    if savedID is None:
                        raise Exception(  # pylint: disable=broad-exception-raised
                            "No savedID provided"
                        )
                    flow = self.flowManager.loadPredefinedFlow(savedID)

                # Get the flow JSON
                flowJson = flow.encode(minimal=False)

                # Get the molstarStte zip file
                molstarState = flow.getMolstarState()

                success = {"ok": True, "flow": flowJson}
                if molstarState is not None:
                    # Convert the molstar state to a hex string
                    molstarState = molstarState.hex()

                    success["molstarState"] = molstarState

                # Return both the flow and the molstar state as binary
                # to be later retrieved by the client as a blob
                return flask.jsonify(success)

            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "error": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/api/updatemolstate", methods=["POST"])
        def updateMolState():
            # The client here sends a form data with two values:
            # - flowPath: The path to the flow
            # - molstarState: The molstar state as a zip file

            # Parse the request data
            request.get_data()

            # Get the data from the request
            flowPath = request.form.get("flowPath", None)

            if flowPath is None:
                success = {
                    "ok": False,
                    "error": "No flowPath provided",
                }

                return flask.jsonify(success)

            file = request.files.get("molstarState", None)

            if file is None:
                success = {
                    "ok": False,
                    "error": "No molstar state provided",
                }

                return flask.jsonify(success)

            try:
                flow = self.flowManager.openFlowFromPath(flowPath)
                flow.saveMolstarState(file.stream.read())
                flow.pendingActions = []
                flow.write()

                success = {
                    "ok": True,
                }

            except Exception as exc:
                success = {
                    "ok": False,
                    "error": str(exc),
                }

            return flask.jsonify(success)

        @self.server.route("/api/isdesktop", methods=["GET"])
        def isDesktop():
            return flask.jsonify(self.desktop)

        @self.server.route("/api/plugins/install", methods=["POST"])
        @desktopOnly
        def installPlugin():
            data = request.get_json()

            path = data.get("file", None)

            try:
                self.pluginManager.installPlugin(self.socketio, path)
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

        @self.server.route("/api/plugins/uninstall", methods=["POST"])
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

        @self.server.route("/api/desktop/appsupportdir", methods=["GET"])
        @desktopOnly
        def openPluginsFolder():
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            AppDelegate().openAppSupportDir()
            return "OK"

        @self.server.route("/api/plugins/list", methods=["GET"])
        @verifyToken
        def listPlugins():
            plugins = self.pluginManager.getPlugins()
            return flask.jsonify(plugins)

        @self.server.route("/api/plugins/listblocks", methods=["GET"])
        @verifyToken
        def listblocks():
            plugins = self.pluginManager.getBlocks()
            return flask.jsonify(plugins)

        @self.server.route("/api/plugins/listpages", methods=["GET"])
        @verifyToken
        def listpages():
            pages = self.pluginManager.getPages()
            return flask.jsonify(pages)

        @self.server.route("/api/plugins/executeblock", methods=["POST"])
        @verifyToken
        def executeBlock():
            data = request.get_json()
            # Execute the action from a given block
            try:
                try:
                    variables = data["variables"]
                    blockID = data["blockID"]
                    workingDir = data["path"]
                    inputs = data["inputs"]
                    flowSavedID = data["flowSavedID"]
                    blockPlacedID = data["blockPlacedID"]
                    selectedInputGroup = data["selectedInputGroup"]
                except KeyError as keye:
                    raise Exception(  # pylint: disable=broad-exception-raised
                        f"Missing key: {keye} in executeBlock request."
                    ) from keye

                resetRemote = data.get("resetRemote", False)
                outputs = self.pluginManager.executeBlockLegacy(
                    blockID,
                    blockPlacedID,
                    variables,
                    inputs,
                    workingDir,
                    flowSavedID,
                    self.socketio,
                    selectedInputGroup=selectedInputGroup,
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
            return flask.jsonify(success)

        @self.server.route("/api/plugins/executeflow", methods=["POST"])
        @verifyToken
        def executeFlow():
            # Get the request data
            data = request.get_json()

            try:
                # Get the flow data
                flowPath = data["flowPath"]
                placedID = data["placedID"]
                resetRemoteBlock = data.get("resetRemote", False)
                resetFlow = data.get("resetFlow", True)

                # Open the flow
                flow = self.flowManager.openFlowFromPath(flowPath)

                # If resetFlow is True, reset the remote too
                if resetFlow:
                    resetRemoteBlock = True

                    # Instantiate a local rAPI
                    from Server.RemotesManager import RemotesAPI

                    rAPI = RemotesAPI()
                    rAPI.deleteFlowFromQueue(flow.savedID)

                # Run the flow
                self.flowManager.runFlow(
                    flow, placedID, resetRemoteBlock, self.socketio, resetFlow
                )

                success = {
                    "ok": True,
                }
            except Exception as exc:
                success = {
                    "ok": False,
                    "message": str(exc),
                }

            return flask.jsonify(success)

        @self.server.route("/api/plugins/stopflow", methods=["POST"])
        @verifyToken
        def stopFlow():
            # Get the flowID from the request
            data = request.get_json()

            flowPath = data.get("flowPath", None)

            if flowPath is None:
                return flask.jsonify({"ok": False, "msg": "No flowPath provided"})

            try:
                stoppedFlow = self.flowManager.stopFlow(flowPath)
                self.socketio.emit(
                    "flow", stoppedFlow.encode(minimal=False), to=stoppedFlow.savedID
                )
                return flask.jsonify({"ok": True})
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/internal/removefinishedflow", methods=["POST"])
        def removeFlowFromQueue():
            flowPath = request.get_json().get("flowPath", None)

            if flowPath is None:
                return "No flowPath provided", 400

            try:
                self.flowManager.removeRunningFlow(flowPath)
                return "OK"
            except Exception as exc:
                return str(exc), 400

        @self.server.route("/api/plugins/config", methods=["POST"])
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
                    "msg": str(exc),
                }
                return flask.jsonify(error)

        @self.server.route("/api/plugins/flows", methods=["GET"])
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

        @self.server.route("/api/desktop/command", methods=["POST", "GET"])
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

        @self.server.route("/api/desktop/openwindow", methods=["POST"])
        @desktopOnly
        def openWindow():
            name = request.get_json()["name"]
            url = request.get_json()["url"]
            fullURL = f"{self.baseURL}/{url}"
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            AppDelegate().openWindow(name, fullURL)
            return "OK"

        @self.server.route("/api/getbrowserurl", methods=["GET"])
        @desktopOnly
        @verifyToken
        def getBrowserURL():
            return flask.jsonify({"url": self.baseURL})

        @self.server.route("/api/openbmode", methods=["GET"])
        @desktopOnly
        @verifyToken
        def openBrowserMode():
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            # Tokenize the url
            url = AppDelegate().tokenize(self.baseURL)
            AppDelegate().openURL(url)
            return "OK"

        @self.server.route("/api/openURL", methods=["POST"])
        @desktopOnly
        @verifyToken
        def openURL():
            from App import AppDelegate

            url = request.get_json().get("url", None)
            if url is None:
                return flask.jsonify({"ok": False, "msg": "No url provided"})

            AppDelegate().openURL(url)

            return flask.jsonify({"ok": True})

        @self.server.route("/api/version", methods=["GET"])
        @verifyToken
        def version():
            try:
                from App import AppDelegate  # pylint: disable=import-outside-toplevel

                appINFO = AppDelegate().APP_INFO

                success = {
                    "ok": True,
                    "appINFO": appINFO,
                }
            except Exception as exc:
                success = {
                    "ok": False,
                    "msg": str(exc),
                }

            return flask.jsonify(success)

        @self.server.route("/api/filepicker", methods=["POST"])
        @verifyToken
        def filePicker():
            path = request.get_json().get("path", os.getcwd())
            extensions = request.get_json().get("extensions", None)
            openFolder = request.get_json().get("openFolder", False)

            if extensions is not None and extensions == ["*"]:
                extensions = None

            if path is None:
                path = os.getcwd()

            if not os.path.exists(path):
                success = {
                    "ok": False,
                    "msg": "Path does not exist",
                }
            elif not os.path.isdir(path):
                success = {
                    "ok": False,
                    "msg": "Path is not a directory",
                }
            else:
                fileExplorer = FileExplorer(path)
                directoryContents = fileExplorer.listDirectory(extensions, openFolder)
                folderChain = fileExplorer.folderChain()
                success = {
                    "ok": True,
                    "folderChain": folderChain,
                    "contents": directoryContents,
                }

            return flask.jsonify(success)

        @self.server.route("/api/openfolder", methods=["GET", "POST"])
        @verifyToken
        def openFolder():
            if self.desktop:
                from App import AppDelegate  # pylint: disable=import-outside-toplevel

                selFolder = AppDelegate().openFolderSelectDialog()
            else:  # Implement folder picker for web/server mode
                print("WARNING: Folder picker not implemented for web/server mode")
                selFolder = "/example/path"

            return flask.jsonify({"path": selFolder})

        @self.server.route("/api/openfile", methods=["GET", "POST"])
        @verifyToken
        def openFile():
            extensions = ("All Files (*.*)",)
            if request.method == "POST":
                recivedExtensions = request.get_json().get("extensions")
                if recivedExtensions:
                    extensions = tuple(
                        f"{ext} files (*.{ext})" for ext in recivedExtensions if ext != "*"
                    )
                    if not extensions:
                        extensions = ("All Files (*.*)",)
            if self.desktop:
                from App import AppDelegate

                selFile = AppDelegate().openFileSelectDialog(fileTypes=extensions)
            else:
                errorMSG = (
                    "ERROR: File picker is already implemented."
                    + " If you are seeing this, something went wrong."
                )
                logging.getLogger("Horus").error(errorMSG)
                selFile = errorMSG

            return flask.jsonify({"path": selFile})

        @self.server.route("/api/savecontents", methods=["POST"])
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

        @self.server.route("/api/remotes/list", methods=["GET"])
        @desktopOnly
        def listRemotes():
            return flask.jsonify(self.remoteManager.listRemotes())

        @self.server.route("/api/remotes/names", methods=["GET"])
        @verifyToken
        def listRemoteNames():
            try:
                remotes = self.remoteManager.listRemotes(includeLocal=True)

                remotes = [r["name"] for r in remotes]

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

        @self.server.route("/api/remotes/configure", methods=["POST"])
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

        @self.server.route("/api/remotes/delete", methods=["POST"])
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

        @self.server.route("/api/settings", methods=["GET"])
        def settings():
            settings = self.settingsManager.listSettings()

            return flask.jsonify({"ok": True, "settings": settings})
            # return flask.render_template("Settings/index.html")

        @self.server.route("/api/restoreSettings", methods=["GET"])
        def settingsDefaults():
            self.settingsManager.restoreDefaults()

            return flask.jsonify({"ok": True})

        @self.server.route("/api/settings/<settingID>", methods=["GET"])
        def setting(settingID):
            try:
                setting = self.settingsManager.getSetting(settingID)
            except Exception as exc:  # pylint: disable=broad-exception-raised
                return flask.jsonify({"ok": False, "msg": str(exc)})

            return flask.jsonify({"ok": True, "setting": setting.toDict()})

        @self.server.route("/api/saveSettings", methods=["POST"])
        def saveSettings():
            data = request.get_json()

            if data is None:
                return flask.jsonify({"ok": False, "msg": "Missing data"})

            settings = data.get("settings", None)

            if settings is None:
                return flask.jsonify({"ok": False, "msg": "Missing settings"})

            try:
                self.settingsManager.saveSettings(settings)
                return flask.jsonify({"ok": True})
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

        # Development
        if self.settingsManager.getSetting("developmentMode").value:

            @self.server.route("/api/plugins/reload", methods=["GET"])
            def reloadPlugins():
                # Reload the plugin manager
                self.pluginManager.reloadPlugins()

                # Reload the plugin pages
                # TODO: Hide the UserWarning from Flask
                self._pluginPages()

                # Emit plugin changes
                self.socketio.emit("pluginChanges")

                return flask.jsonify({"ok": True})

        # View routes
        @self.server.route("/")
        def index():
            # Get the query string
            shemsu = request.args.get("shemsu", None)

            if shemsu is not None:
                if shemsu == webview.token:
                    # Starting server in browser mode
                    return flask.render_template("Main/index.html", shemsu=shemsu)

            return flask.render_template("Main/index.html")

        @self.server.route("/plugins/", methods=["GET"])
        @desktopOnly
        def pluginsManager():
            return flask.render_template("PluginsManager/index.html", shemsu=self.token)

        @self.server.route("/bmode", methods=["GET"])
        @desktopOnly
        def bmode():
            return flask.render_template("BrowserMode/index.html")

        @self.server.route("/about", methods=["GET"])
        @verifyToken
        def about():
            return flask.render_template("About/index.html", shemsu=self.token)

        @self.server.route("/remotes", methods=["GET"])
        @desktopOnly
        def remotes():
            return flask.render_template("Remotes/index.html")

        @self.server.route("/settingsview")
        def settingsView():
            return flask.render_template("Settings/index.html")

        @self.server.after_request
        def addHeader(response):
            # Disable caching
            # response.headers["Cache-Control"] = "no-store"
            return response

    def _setupSocketio(self):
        """
        Sets the socketio server instance
        """

        # Instantiate the SocketIO class with the server and the async_mode
        try:
            self.socketio = HorusSocket(
                self.server,
                self.baseURL,
                cors_allowed_origins="*" if self.debug else self.baseURL,
                async_mode="threading" if self.debug else "eventlet",
                manage_session=False,
            )
        except ValueError as valerr:
            print(f"WARNING: Could not start socketio server: {valerr}. Forcing eventlet")
            self.socketio = HorusSocket(
                self.server,
                self.baseURL,
                cors_allowed_origins="*" if self.debug else self.baseURL,
                async_mode="eventlet",
                manage_session=False,
            )

        # Add a new Flask request so that background processes can emit
        @self.server.route("/internal/backgroundsocketio/", methods=["POST"])
        def backgroundProcessSocketio():
            """
            Route to emit socketio events from background processes
            """

            # Get the data from the request
            data = request.get_json()

            if data is None:
                return "No data provided", 400

            # Get the data from the queue
            event = data.get("event", None)
            args = data.get("args", None)
            kwargs = data.get("kwargs", None)

            # Emit the event
            self.socketio.emit(event, *args, **kwargs)

            # Return 200 status
            return "OK"

        # Add a new Flask request so that the HorusSocket can check whether the
        # client has currently vieweing the flow
        @self.server.route("/internal/checkjoinedflow/", methods=["POST"])
        def checkJoinedFlow():
            """
            Route to check if the client has joined a flow
            """

            # Get the data from the request
            data = request.get_json()

            if data is None:
                return "No data provided", 400

            # Get the data from the queue
            flowSavedID = data.get("flowSavedID", None)

            # Check if the client has joined the flow
            if self.socketio.isClientJoinedFlow(flowSavedID):
                return "OK"
            else:
                return "Not joined", 400

    def _pluginPages(self):
        """
        Setup the plugin pages
        """

        from Server.PluginManager import PluginDeps, PrintSocketCapturer

        # Create a wrapper function to add to
        # python path the plugin deps folder
        def viewFunctionWrapper(func, page, endPoint):
            @wraps(func)
            def wrapper(*args, **kwargs):
                with PrintSocketCapturer(self.socketio):
                    with PluginDeps(page._pageInfo["pluginDir"]):
                        result = endPoint.function(*args, **kwargs)
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

                    logging.getLogger("Horus").debug(
                        "Added endpoint '%s' to page '%s'", epURL, page._pageInfo["id"]
                    )

                return newBluePrint

            # Call the function with the current htmlPath
            parsedBluePrint = createBlueprint(page, htmlPath, url)

            # Register the blueprint
            try:
                self.server.register_blueprint(parsedBluePrint)

                logging.getLogger("Horus").debug(
                    "Registered page %s for plugin %s",
                    page._pageInfo["id"],  # pylint: disable=protected-access
                    page._pageInfo["pluginDir"],  # pylint: disable=protected-access
                )
            except Exception as exc:  # pylint: disable=broad-exception-caught

                if "The setup method 'register_blueprint'" not in str(exc):
                    errorMSG = (
                        "\033[91mError registering page for plugin: "
                        + page.id
                        + ": "
                        + str(exc)
                        + "\033[0m"
                    )
                    logging.getLogger("Horus").error(errorMSG)
                else:
                    logging.getLogger("Horus").warning(str(exc))

    def _debugRoutes(self):
        @self.server.route("/stop", methods=["GET"])
        def stop():
            # Get the current process
            currentProcess = os.getpid()

            logging.getLogger("Horus").debug("Stopping server with PID %s", currentProcess)

            # Kill the process
            os.kill(currentProcess, 1)

            return "OK"

    def _exceptionHandlers(self):
        @self.server.errorhandler(jinja2.exceptions.TemplateNotFound)
        def templateNotFoundHandler(error):
            errorMSG = f"View not found: {error}"

            horusLogger = logging.getLogger("Horus")
            horusLogger.error(errorMSG)

            return flask.render_template("Error/error.html", errormsg=str(errorMSG))

        # Setup the 404 page
        @self.server.errorhandler(404)
        def pageNotFound(error):
            errorMSG = (
                "If you are trying to load an extension, please "
                + "make sure to restart the app after installing it."
            )
            horusLogger = logging.getLogger("Horus")
            horusLogger.error("Page not found: %s", str(error))

            return flask.render_template("Error/error.html", errormsg=errorMSG)

        # Setup a template not found error
        @self.server.route("/error")
        def error():
            horusLogger = logging.getLogger("Horus")
            horusLogger.error("Error page requested")

            return flask.render_template("Error/error.html")

        # For extreme cases, setup a broad exception handler
        @self.server.errorhandler(Exception)
        def exceptionHandler(error):
            horusLogger = logging.getLogger("Horus")
            horusLogger.critical(
                "%s. Data: %s. Request: %s", error, str(request.data), str(request)
            )

            return flask.render_template("Error/error.html", errormsg=str(error))

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

    def _startSession(self):
        """
        Loads Flask-Session on the server
        """

        # Setup the session
        self.server.config["SESSION_TYPE"] = "filesystem"
        self.server.config["SESSION_FILE_DIR"] = os.path.join(self.appSupportDir, "sessions")
        # self.server.config["SESSION_PERMANENT"] = True
        # self.server.config["SECRET_KEY"] = "very_secret_key"
        # self.server.config["SESSION_COOKIE_NAME"] = "horus_session"
        # self.server.config["SESSION_COOKIE_HTTPONLY"] = True
        # self.server.config["SESSION_COOKIE_SECURE"] = True
        # self.server.config["SESSION_COOKIE_SAMESITE"] = "Lax"
        # #self.server.config["SESSION_COOKIE_DOMAIN"] = self.host
        # self.server.config["SESSION_COOKIE_PATH"] = "/"
        # self.server.config["SESSION_COOKIE_MAX_AGE"] = 60 * 60 * 24 * 7 * 2
        # self.server.config["SESSION_COOKIE_SAMESITE"] = "Lax"

        # Start the session
        Session(self.server)

    def run(self, reloader: bool = False):
        """
        Runs the server using the socketio.run method
        """
        # use_reloader has to be turned off in order to run in a secondary thread

        if not self.desktop:
            print("Running server mode at: " + self.baseURL)

        # Define the arguments for socketio.run
        runArgs = {
            "host": self.host,
            "port": self.port,
            "debug": self.debug,
            "use_reloader": reloader,
            "log_output": self.debug,
        }

        # Add allow_unsafe_werkzeug argument if in debug mode
        if self.debug and not cython.compiled:
            runArgs["allow_unsafe_werkzeug"] = self.debug

        # Start the server
        self.socketio.run(self.server, **runArgs)

    def backgroundRun(self, func: typing.Callable):
        """
        Runs the given function in a background process. This function requires
        and active request context.

        :param func: The function to run in the background
        """

        # Define a function to run the request on
        def requestRunner(environment):
            with self.server.request_context(environment):
                func()

        # Start a new process for the flowRunner function
        process = Process(  # pylint: disable=not-callable
            target=requestRunner, args=(request.environ,)
        )
        process.start()

        # Return the process object
        return process


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


class HorusSocket(SocketIO):
    """
    Subclass of SocketIO to add some new functionalities
    """

    # Joined rooms
    joinedRooms: typing.Dict[str, typing.List[str]] = {}
    """
    A dictionary with the rooms joined by each client
    """

    def __init__(
        self,
        server: Flask,
        baseURL: str,
        *,
        manage_session: bool = True,
        channel: str = "flask-socketio",
        path: str = "socket.io",
        resource: str = "socket.io",
        **kwargs,
    ) -> None:
        super().__init__(
            server,
            manage_session=manage_session,
            channel=channel,
            path=path,
            resource=resource,
            **kwargs,
        )

        self.baseURL = baseURL

        # Replace the emit function
        self._replaceEmit()

        # Add the socketio routes
        self._socketIORoutes()

    def _replaceEmit(self):
        """
        Replace the .emit function to always include the room as the session id
        """

        oldEmit = self.emit

        def newEmit(event, *args, **kwargs):
            if "to" in kwargs:
                toValue = kwargs["to"]
                if toValue is not None:
                    kwargs["room"] = kwargs["to"]
                    kwargs.pop("to")

            if "room" not in kwargs:
                # Verify that we have request context
                sid = None
                if flask.has_request_context():
                    if hasattr(request, "sid") and request.sid is not None:  # type: ignore
                        sid = request.sid  # type: ignore
                    elif request:
                        sid = request.headers.get("socketiosid", None)
                else:
                    logging.getLogger("Horus").critical("Working outside of request context.")

                if sid is not None or sid != "" or sid != "null":
                    kwargs["room"] = sid
                else:
                    logging.getLogger("Horus").error(
                        "No session id found for socketio emit. Not sending message."
                    )
                    return

            # If we are in a background process, send the message through a new Flask request
            if mp.current_process().name != "MainProcess":
                logging.getLogger("Horus").debug(
                    "Event from background process %s: %s",
                    mp.current_process().name,
                    event,
                )

                # Get the data from the queue
                data = {
                    "event": event,
                    "args": args,
                    "kwargs": kwargs,
                }

                # Send the data to the server
                try:
                    requests.post(
                        f"{self.baseURL}/internal/backgroundsocketio/",
                        json=data,
                        timeout=5,
                    )
                except requests.exceptions.RequestException:
                    logging.getLogger("Horus").error(
                        "Could not connect to server to emit event %s", event
                    )

                return

            logging.getLogger("Horus").debug(
                "Emitting event %s to room %s", event, kwargs["room"]
            )

            return oldEmit(event, *args, **kwargs)

        self.emit = newEmit

    def _socketIORoutes(self):
        """
        Setup the socket.io routes endpoints
        """

        # Setup per-flow rooms (based on flowID)
        @self.on("joinFlow")
        def joinFlow(flowID):
            sid = request.sid  # type: ignore

            if flowID is None:
                return

            logging.getLogger("Horus").info("Joined room for flowID %s", flowID)

            # Join the flow room
            join_room(flowID)

            if sid not in self.joinedRooms:
                self.joinedRooms[sid] = []

            self.joinedRooms[sid].append(flowID)

        @self.on("leaveFlow")
        def leaveFlow(flowID):
            sid = request.sid  # type: ignore
            if flowID is None:
                return

            logging.getLogger("Horus").debug("Left room for flowID %s", flowID)

            # Leave the flow room
            leave_room(flowID)

            if sid in self.joinedRooms:
                if flowID in self.joinedRooms[sid]:
                    self.joinedRooms[sid].remove(flowID)

        # Log the socketio connections
        @self.on("connect")
        def connect():
            sid = request.sid  # type: ignore
            logging.getLogger("Horus").info("SocketIO client connected: %s", sid)

        # Log the socketio disconnections
        @self.on("disconnect")
        def disconnect():
            sid = request.sid  # type: ignore
            logging.getLogger("Horus").info("SocketIO client disconnected: %s", sid)

            self.joinedRooms.pop(sid, None)

        @self.on("message")
        def handleMessage(data):
            print("received message: " + data)
            self.emit("printTerm", "Hello from the server!")

    def isClientJoinedFlow(self, flowID: str) -> bool:
        """
        Check if the client has joined the flow
        """

        # If we are in a background process,
        # send a request to the server to check
        # if the client has joined the flow
        if mp.current_process().name != "MainProcess":
            # Get the data from the queue
            data = {
                "flowSavedID": flowID,
            }

            # Send the data to the server
            try:
                response = requests.post(
                    f"{self.baseURL}/internal/checkjoinedflow/",
                    json=data,
                    timeout=5,
                )
            except requests.exceptions.RequestException:
                logging.getLogger("Horus").error(
                    "Could not connect to server to check if client has joined the flow"
                )
                return False

            if response.status_code == 200:
                return True
            else:
                return False
        else:
            for _, joinedRooms in self.joinedRooms.items():
                if flowID in joinedRooms:
                    return True

            return False

    def removeFinishedFlowFromRunningFlows(self, flowPath: str):
        """
        Removes from the current running flows list the provided flow
        """

        if mp.current_process().name != "MainProcess":
            # Get the data from the queue
            data = {
                "flowPath": flowPath,
            }

            # Send the data to the server
            try:
                response = requests.post(
                    f"{self.baseURL}/internal/removefinishedflow",
                    json=data,
                    timeout=5,
                )
            except requests.exceptions.RequestException:
                logging.getLogger("Horus").error(
                    "Could not connect to server to remove finished flow"
                )
                return False

            if response.status_code == 200:
                return True
            else:
                return False
        else:
            raise Exception(
                "removeFinishedFlowFromRunningFlows can only be called from a background process"
            )
