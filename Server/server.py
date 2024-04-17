# pylint: disable=too-many-lines
"""
The HorusServer module
"""

# Critical imports
# import eventlet

# eventlet.monkey_patch()

# Tools
import os
import shutil
import sys
import hashlib
import logging
import typing
import traceback

# Decorators
from functools import wraps

# Import random to generate a random port number
import random

# Socket for checking available ports
import socket

# Ctyhon
import cython

# Multiprocess module, a fork of multiprocessing with enhancements
import eventlet.wsgi
from multiprocess import Process, Semaphore  # type: ignore pylint: disable=no-name-in-module
import multiprocess.process as mp
import multiprocessing  # For the number of CPUs
import threading  # For background socketio thread

# Flask
import flask
import jinja2
from flask import Flask, request
from flask_socketio import SocketIO, join_room, leave_room
from flask_cors import CORS
import flask_login

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

# User management for WebApp mode
from Server.WebAppManager import WebAppManager, UserError
from Server.WebAppManager import HorusUser

if typing.TYPE_CHECKING:
    from Server.WebAppManager import Database
    from Server.FlowManager import Flow

    # Cast the flask_login UserMixin to the HorusUser class
    currentUser = typing.cast(HorusUser, flask_login.current_user)
else:
    currentUser = flask_login.current_user


class HorusServer:
    """
    The Horus server class. The server always runs in the background, even when the
    application is in desktop mode. This is because the server is used to communicate
    between the frontend and the python backed.
    """

    webAppManager: typing.Optional[WebAppManager] = None
    """
    Server configuration when running in webapp mode
    """

    _remoteManager: RemotesManager
    """
    Internal remote manager class. Handle remote connections, configurations and commands.
    """

    _flowManager: FlowManager
    """
    Internal flowManager class. Handle saving and opening of flows.
    """

    _settingsManager: SettingsManager
    """
    Global settings manager class. Handle the app settings.
    """

    @property
    def remoteManager(self) -> RemotesManager:
        """
        Remote manager class. Handle remote connections, configurations and commands.
        On webapp mode, this will be instantiated with the user's directory
        """

        return (
            RemotesManager(currentUser.appSupportDir) if self._isForUser else self._remoteManager
        )

    @property
    def flowManager(self) -> FlowManager:
        """
        FlowManager class. Handle saving and opening of flows.
        On webapp mode, this will be instantiated with the user's directory
        """

        return FlowManager(currentUser.appSupportDir) if self._isForUser else self._flowManager

    @property
    def settingsManager(self) -> SettingsManager:
        """
        Settings manager class. Handle the app settings.
        """

        return (
            SettingsManager(currentUser.appSupportDir)
            if self._isForUser
            else self._settingsManager
        )

    @property
    def _isForUser(self) -> bool:
        """
        Check if the request is for a user or global
        """

        if (
            self.mode == "webapp"
            and currentUser is not None
            and hasattr(currentUser, "appSupportDir")
        ):
            return True

        return False

    def __init__(
        self,
        debug=False,
        mode: str = "server",
        appSupportDir=None,
        host=None,
        port=None,
    ):

        # Mode of the server
        self.mode = mode

        # If on webApp mode, check for the existance of the configuration file
        if self.mode == "webapp":
            if not os.path.exists(WebAppManager.HORUS_CONFIG_FILE):
                raise FileNotFoundError("Missing horus.config.json file")

            # Load the webapp manager
            self.webAppManager = WebAppManager()

            # Override the host and port if none was provided
            host = host if host else self.webAppManager.host
            port = port if port else self.webAppManager.port

            # Start the database if required
            self.webAppManager.startDatabase()
        else:
            self.webAppManager = None

        # App support directory. In webapp mode, this is not used
        if appSupportDir is None:
            self.appSupportDir = os.path.abspath(os.path.join("AppSupport"))
        else:
            self.appSupportDir = appSupportDir

        # Basic Flask setup
        self.debug = debug
        self.host = host if host else "localhost"
        self.port = port if port else self._getFreePort()
        self.baseURL = f"http://{self.host}:{self.port}"

        # If we are running on host 0.0.0.0, get the real base URL
        localIp = None
        if self.host == "0.0.0.0":
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            localIp = s.getsockname()[0]
            self.baseURL = f"http://{localIp}:{self.port}"

        # Check that the baseURL is not in use
        if not self.debug:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                sock.bind((localIp or self.host, self.port))
            except OSError as ose:
                raise Exception(  # pylint: disable=broad-exception-raised
                    f"Adress {self.baseURL} is already in use"
                ) from ose

        logging.getLogger("Horus").info("Host: %s", self.host)
        logging.getLogger("Horus").info("Port: %s", self.port)
        logging.getLogger("Horus").info("BaseURL: %s", self.baseURL)

        self.desktop = self.mode == "app" or self.mode == "browser"
        """
        Handy variable for checking if we are running in "Desktop" app or just as a server
        """

        self.safeMode = self.mode == "webapp"
        """
        Handy variable for checking if we are running in "WebApp" mode, thus "safe mode"
        """

        # Initialize the plugin manager. This is global nad for all users the same
        # On webapp mode, user cannot modify the plugins
        self.pluginManager = PluginManager(self.appSupportDir)
        """
        The plugin manager class. Handle plugin installation, loading and block execution.
        """

        # Initialize the global settings manager. On webapp mode, this is only used
        # for the startup of the app. Then, each user has its own settings manager
        self._settingsManager = SettingsManager(self.appSupportDir)
        """
        Settings manager class. Handle the app settings.
        """

        # Initialize the Remotes Manager
        self._remoteManager = RemotesManager(self.appSupportDir)
        """
        Remote manager class. Handle remote connections, configurations and commands.
        """

        # Initialize the flow manager
        self._flowManager = FlowManager(self.appSupportDir)
        """
        FlowManager class. Handle saving and opening of flows.
        """

        # Setup the maximum number of processes per flow
        self._setupSemaphore()

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

        # Setup the users routes
        if (
            self.webAppManager
            is not None
            # and self.webAppManager.userManagement.requireRegistration
            # For webapp mode without registration, we still need the user routes
            # even thouth the users will be demo users
        ):
            self._userRoutes()

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

    def _guiDir(self):
        """
        Checks for the GUI directory
        """

        guiDir = None
        # Development path
        if not cython.compiled:
            guiDir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "GUI"))
        # Frozen executable path
        else:
            try:
                bundleDir = sys._MEIPASS  # type: ignore pylint: disable=protected-access
                guiDir = os.path.abspath(os.path.join(bundleDir, "GUI"))
            except AttributeError as attre:
                raise Exception(  # pylint: disable=broad-exception-raised
                    "App not frozen and GUI directory not found."
                    + " Did you forget to build the View?"
                ) from attre

        if guiDir is None or not os.path.exists(guiDir):
            raise FileNotFoundError("GUI directory not found")

        return guiDir

    def _setupLoginManager(self, server):
        """
        Setup the Flask-Login manager
        """

        if self.webAppManager is None:
            raise Exception("WebAppManager not instantiated")

        loginManager = flask_login.LoginManager()
        loginManager.init_app(server)

        # If we require registration, setup the login manager
        # with the database
        db = None
        if self.webAppManager.userManagement.requireRegistration:
            db = self.webAppManager.db

            if db is None:
                raise Exception("Database not found")

            # Set the secret key for the session
            server.secret_key = db.dbConfig.secretKey
        else:
            # Set the secret key for the session
            server.secret_key = os.urandom(24)

        @loginManager.user_loader
        def load_user(user_id):  # pylint: disable=invalid-name

            # If the webapp manager is not instantiated, return None
            if self.webAppManager is None:
                return None

            # Cast the user_id to int
            user_id = int(user_id)

            # If the userID is -1, then it is a demo user
            if user_id == -1:
                return HorusUser.demoUser()

            # If we do not require registration, return the anonymous user with
            # the correct ID
            if not self.webAppManager.userManagement.requireRegistration:
                return HorusUser.anonymousUser(
                    self.webAppManager.userManagement.appSupportDir, user_id
                )

            # If the user is not a demo user, get the user from the database
            if db is None:
                raise Exception("Internal error: Database not found")

            return db.getUser(id=user_id)

        @loginManager.needs_refresh_handler
        def refresh():

            logging.getLogger("Horus").debug(
                "User %s needs refresh for accessing this request %s",
                currentUser.email,
                request.url,
            )

            # Log the user out
            flask_login.logout_user()

            return flask.redirect("/users/login")

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

        # If we are on webapp mode
        # setup the login manager
        if self.webAppManager:
            self._setupLoginManager(server)

        # Setup CORS
        self._setupCORS(server)

        return server

    def _setupCORS(self, server: Flask):

        # Default configuration for server mode, app mode...
        resources = {r"/*": {"origins": "*"}}
        origins = "*"

        # Load specific configuration from the JSON in webapp mode
        if self.webAppManager:
            resources = self.webAppManager.cors.resources
            origins = self.webAppManager.cors.origins

        logging.getLogger("Horus").info("CORS Resources: %s", str(resources))
        logging.getLogger("Horus").info("CORS Origins: %s", origins)

        CORS(server, resources=resources, origins=origins)

        # Save the configuration in the class
        self.origins = origins

    # Create a wrapper for login (only applies to webapp mode and requires registration)
    def verifyLogin(self, func):
        """
        In webapp mode, this wrapper will prevent access to the route if the user is not
        logged in. If the user is not logged in, it will redirect to the login page.
        """

        @wraps(func)
        def wrapper(*args, **kwargs):
            # If we are on webapp mode, and we require users to be logged in
            # this wrapper will prevent access to the route if the user is not logged in
            if self.webAppManager and self.webAppManager.userManagement.requireRegistration:
                # Check that the user is logged in
                if not currentUser.is_authenticated:
                    return flask.redirect("/users/login")
            elif self.webAppManager and not self.webAppManager.userManagement.requireRegistration:
                # If we are on webapp mode, and we do not require registration
                # Authenticate the demo user if not authenticated
                if currentUser is not None and currentUser.is_authenticated:
                    return func(*args, **kwargs)
                else:
                    # Login the demo user
                    return flask.redirect("/users/login")

            return func(*args, **kwargs)

        return wrapper

    def verifyAdmin(self, func):
        """
        For webapp mode, this wrapper will prevent access to the route if the user is not
        an admin. If the user is not an admin, it will return a JSON response with an error
        message.
        """

        @wraps(func)
        # @flask_login.fresh_login_required
        def wrapper(*args, **kwargs):
            # If we are on webapp mode, and we require users to be logged in
            # this wrapper will prevent access to the route if the user is not logged in
            if not currentUser.admin:
                return flask.jsonify(
                    {"ok": False, "msg": "You do not have permission to perform this action."}
                )

            return func(*args, **kwargs)

        return wrapper

    # Wrapper for demo user restriction
    def stopDemoUser(self, func):
        """
        On webapp mode, this wrapper will prevent access to the route if the user is a demo
        user. If the user is a demo user, it will return a JSON response with an error
        message.
        """

        @wraps(func)
        def wrapper(*args, **kwargs):

            if self.webAppManager is None or self.webAppManager.userManagement is None:
                return func(*args, **kwargs)

            # Stop the user only if we require registration
            if self.webAppManager.userManagement.requireRegistration:
                if currentUser is not None and currentUser.isDemo:
                    return flask.jsonify(
                        {"ok": False, "msg": "To use this feature, please register."}
                    )

            return func(*args, **kwargs)

        return wrapper

    # Wrapper for preventing access in the webapp mode
    def preventOnWebApp(self, specialBypass: str):
        """
        This wrapper will prevent access to the route if the server is running in webapp
        mode. If the server is running in webapp mode, it will return a JSON response with
        an error message.
        """

        def wrapper(func):
            @wraps(func)
            def wrapperFunc(*args, **kwargs):

                bypass = False
                if self.webAppManager is not None:
                    um = self.webAppManager.userManagement
                    if specialBypass == "allowUpload":
                        bypass = um.fileManagement.allowUpload
                        if bypass:
                            # Check the request for the file size too
                            for f in request.files.values():
                                # Get the size in MB
                                size = len(f.read()) / (1024 * 1024)
                                if size > um.fileManagement.maxUploadSize:
                                    return flask.jsonify(
                                        {
                                            "ok": False,
                                            "msg": f"The file size exceeds the limit of {um.fileManagement.maxUploadSize} MB",
                                        }
                                    )
                    elif specialBypass == "allowDownload":
                        bypass = um.fileManagement.allowDownload
                    elif specialBypass == "allowDelete":
                        bypass = um.fileManagement.allowDelete
                    elif specialBypass == "allowNewFolder":
                        bypass = um.fileManagement.allowNewFolder

                if self.webAppManager is not None and not bypass:
                    return flask.jsonify(
                        {
                            "ok": False,
                            "msg": "This function is not available.",
                        }
                    )
                return func(*args, **kwargs)

            return wrapperFunc

        return wrapper

    # Wrapper for preventing flow execution if the user has reached the quota
    def verifyQuotas(self, func):
        """
        In webapp mode, this wrapper will prevent access to the route if the user has
        reached the quota. If the user has reached the quota, it will return a JSON
        response with an error message.
        """

        @wraps(func)
        def wrapper(*args, **kwargs):
            if self.webAppManager is not None:
                if self.webAppManager.db is not None and self.webAppManager.db.hasReachedQuota(
                    currentUser
                ):
                    return flask.jsonify(
                        {
                            "ok": False,
                            "msg": "You have reached your quota. "
                            + "Please remove some flows to continue.",
                        }
                    )
                else:
                    aq = self.webAppManager.userManagement.anonymousQuotas

                    if aq is None:
                        return flask.jsonify(
                            {"ok": False, "msg": "Internal server error. Try again later."}
                        )

                    # Verify that the anonymous user has no more than 10 flows
                    flowsCount = os.listdir(currentUser.flowsDir)
                    if len(flowsCount) >= aq.maxFlows:
                        return flask.jsonify(
                            {
                                "ok": False,
                                "msg": "You have reached the maximum number of flows.",
                            }
                        )
            return func(*args, **kwargs)

        return wrapper

    # Create a wrapper for checking if the app is on desktop mode or web mode
    def noWebApp(self, func):
        """
        This wrapper blocks access to the route if the server is not running in desktop
        mode / regular server mode. It will return a JSON response
        with an error message.
        """

        @wraps(func)
        def wrapper(*args, **kwargs):
            if self.mode == "webapp":
                error = {
                    "ok": False,
                    "msg": "This function is not available on webapp mode",
                }
                logging.getLogger("Horus").error(error["msg"])
                return flask.jsonify(error)
            return func(*args, **kwargs)

        return wrapper

    def allowRemotes(self, func):
        """
        On webapp mode, this wrapper will prevent access to the route if the server is not
        allowing remote connections. If the server is not allowing remote connections, it
        will return a JSON response with an error message.
        """

        @wraps(func)
        def wrapper(*args, **kwargs):
            if self.webAppManager is not None and not self.webAppManager.allowRemotes:
                error = {
                    "ok": False,
                    "msg": "This function is not available",
                }
                logging.getLogger("Horus").error(error["msg"])
                return flask.jsonify(error)
            return func(*args, **kwargs)

        return wrapper

    def _routes(self):
        # API routes
        @self.server.route("/api/saveflow", methods=["POST"])
        @self.verifyLogin
        @self.stopDemoUser
        @self.verifyQuotas
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
                    "msg": "No data provided",
                }

                return flask.jsonify(success)

            # Get the flow data and the molstar state
            flowData = data.get("flowData", None)

            if flowData is None:
                success = {
                    "ok": False,
                    "msg": "No flowData provided",
                }

                return flask.jsonify(success)

            # Parse the data string as JSON
            flowData = flask.json.loads(flowData)

            # Get the molstar state
            molstarState = files.get("molstarState", None)

            # Read the bytes of the state
            if molstarState is not None:
                molstarState.stream.seek(0)
                molstarState = molstarState.stream.read()

            try:

                # If we are on webapp mode, update the relative path to the user's folder
                # All flows are stored in individual user folders
                if self.webAppManager is not None:
                    currentPath = flowData["path"]

                    # If the flow has no path (is new)
                    # then give it the user's directory
                    # Create it by generating a
                    # container folder with the sanitized name. Then, the flow will be
                    # saved inside this folder
                    if currentPath is None:
                        from pathvalidate import sanitize_filepath

                        sanitizedName = sanitize_filepath(flowData["name"], max_len=30)
                        sanitizedName = sanitizedName.replace(" ", "_")

                        # Create the folder
                        finalPath = os.path.join(currentUser.flowsDir, sanitizedName)
                        os.makedirs(finalPath, exist_ok=True)

                        # Update the path
                        flowData["path"] = os.path.join(sanitizedName, sanitizedName + ".flow")

                    # Finally, update the path to the user's directory
                    flowData["path"] = currentUser.getUserPath(flowData["path"])[0]

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
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/api/openflow", methods=["GET"])
        @self.verifyLogin
        def openFlow():

            if not self.flowManager:
                return flask.jsonify({"ok": False, "msg": "Flow manager not instantiated"})

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
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/api/recentflows", methods=["GET"])
        @self.verifyLogin
        def recentFlows():
            try:
                flows = self.flowManager.listRecentFlows()

                # If we are in webapp mode, remove the part of the paths that is not
                # accessible by the user (otside its directory)
                if self.webAppManager is not None:
                    highestBoundary = os.path.abspath(currentUser.flowsDir)
                    for flow in flows:
                        flow.path = (
                            flow.path.replace(highestBoundary, "") if flow.path else flow.path
                        )

                # Convert the flows to JSON
                flows = [flow.encode() for flow in flows]

                success = {"ok": True, "flows": flows}
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/api/cleanrecents", methods=["GET"])
        @self.verifyLogin
        def cleanRecents():

            # If we ar eon webapp mode, prevent users from cleaning the recents
            if self.webAppManager is not None:
                return flask.jsonify(
                    {
                        "ok": False,
                        "msg": "This function is not available on webapp mode",
                    }
                )

            try:
                self.flowManager.cleanRecentFlows()
                success = {"ok": True}
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/api/openrecentflow", methods=["POST"])
        @self.verifyLogin
        def openRecentflow():
            try:
                data = request.get_json()
                if data is None:
                    raise Exception("No data provided")  # pylint: disable=broad-exception-raised
                savedID = data.get("savedID", None)
                path = data.get("path", None)
                if path is not None:

                    # If we are on webapp mode, update the path to the user's directory
                    if self.webAppManager is not None:
                        # Update the path to the user's directory
                        path, _ = currentUser.getUserPath(path)

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

                # On webapp mode, remove the full path
                if self.webAppManager is not None:
                    _, highestBoundary = currentUser.getUserPath(path)
                    flow.path = flow.path.replace(highestBoundary, "") if flow.path else flow.path

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
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/api/updatemolstate", methods=["POST"])
        @self.verifyLogin
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
                    "msg": "No flowPath provided",
                }

                return flask.jsonify(success)

            file = request.files.get("molstarState", None)

            if file is None:
                success = {
                    "ok": False,
                    "msg": "No molstar state provided",
                }

                return flask.jsonify(success)
            try:

                # If we are on webapp mode, update the path to the user's directory
                if self.webAppManager is not None:
                    # Update the path to the user's directory
                    flowPath, _ = currentUser.getUserPath(flowPath)

                # Open the flow
                flow = self.flowManager.openFlowFromPath(flowPath)

                # Seek the stream at the starting byte to load it
                file.stream.seek(0)
                molState = file.stream.read()
                flow.pendingActions = []
                flow.write(molState)

                success = {
                    "ok": True,
                }

            except Exception as exc:
                success = {
                    "ok": False,
                    "msg": str(exc),
                }

            return flask.jsonify(success)

        @self.server.route("/api/internal", methods=["GET"])
        def isDesktop():

            internalSettings = {
                "isDesktop": self.desktop,
                "mode": self.mode,
                "debug": self.debug,
            }

            if self.webAppManager is not None:
                internalSettings["webApp"] = {
                    "requireRegistration": self.webAppManager.userManagement.requireRegistration,
                    "appName": self.webAppManager.appName,
                    "companyName": self.webAppManager.companyName,
                    "allowRemotes": self.webAppManager.allowRemotes,
                    "allowDemoUser": self.webAppManager.userManagement.allowDemoUser,
                    "uploadSize": self.webAppManager.userManagement.fileManagement.maxUploadSize,
                }

            return flask.jsonify(internalSettings)

        @self.server.route("/api/plugins/install", methods=["POST"])
        @self.noWebApp
        def installPlugin():
            data = request.get_json()

            path = data.get("file", None)

            try:
                self.pluginManager.installPlugin(self.socketio, path)
                success = {
                    "ok": True,
                }
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/api/plugins/uninstall", methods=["POST"])
        @self.noWebApp
        def uninstallPlugin():
            data = request.get_json()
            pluginName = data.get("name", None)
            if pluginName is None:
                success = {
                    "ok": False,
                    "msg": "Plugin name not provided.",
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
                    "msg": str(exc),
                }
            return success

        @self.server.route("/api/desktop/appsupportdir", methods=["GET"])
        @self.noWebApp
        def openPluginsFolder():
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            AppDelegate().openAppSupportDir()
            return "OK"

        @self.server.route("/api/plugins/list", methods=["GET"])
        @self.verifyLogin
        def listPlugins():
            plugins = self.pluginManager.getPlugins()
            return flask.jsonify(plugins)

        @self.server.route("/api/plugins/listblocks", methods=["GET"])
        @self.verifyLogin
        def listblocks():
            plugins = self.pluginManager.getBlocks()
            return flask.jsonify(plugins)

        @self.server.route("/api/plugins/listpages", methods=["GET"])
        @self.verifyLogin
        def listpages():
            pages = self.pluginManager.getPages()
            return flask.jsonify(pages)

        @self.server.route("/api/plugins/executeflow", methods=["POST"])
        @self.verifyLogin
        @self.stopDemoUser
        @self.verifyQuotas
        def executeFlow():
            # Get the request data
            data = request.get_json()

            try:
                # Get the flow data
                flowPath = data["flowPath"]

                if self.webAppManager is not None:
                    flowPath, _ = currentUser.getUserPath(flowPath)

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

                # If we are on webappmode, register the flow
                # into the database for the current user
                if self.webAppManager is not None and self.webAppManager.db is not None:
                    self.webAppManager.db.registerFlowForUser(currentUser, flow)

                # Run the flow
                self.flowManager.runFlow(
                    flow, placedID, resetRemoteBlock, self.socketio, resetFlow
                )

                success = {
                    "ok": True,
                }
            except Exception as exc:

                logging.getLogger("Horus").error("Could not execute flow: %s", str(exc))

                success = {
                    "ok": False,
                    "msg": str(exc),
                }

            return flask.jsonify(success)

        @self.server.route("/api/plugins/stopflow", methods=["POST"])
        @self.verifyLogin
        def stopFlow():
            # Get the flowID from the request
            data = request.get_json()

            flowPath = data.get("flowPath", None)

            if flowPath is None:
                return flask.jsonify({"ok": False, "msg": "No flowPath provided"})

            try:

                # Convert the flow to the user's directory
                if self.webAppManager is not None:
                    flowPath, _ = currentUser.getUserPath(flowPath)

                stoppedFlow = self.flowManager.stopFlow(flowPath)

                # Update the flow in the database
                if self.webAppManager is not None and self.webAppManager.db is not None:
                    self.webAppManager.db.updateFlowForUser(stoppedFlow)

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

                # If on webapp mode, we can update the database
                # with the flow elapsed time and size
                if self.webAppManager is not None and self.webAppManager.db is not None:
                    # Load the flow
                    flow = self.flowManager.openFlowFromPath(flowPath)

                    # Update the database
                    self.webAppManager.db.updateFlowForUser(flow)

                return "OK"
            except Exception as exc:
                return str(exc), 400

        @self.server.route("/api/plugins/config", methods=["POST"])
        @self.verifyLogin
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
        @self.verifyLogin
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
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/api/desktop/command", methods=["POST", "GET"])
        @self.noWebApp
        def executeCommand():
            data = request.get_json()
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            try:
                AppDelegate().executeCommand(data["command"], self.socketio)
                return {"ok": True}
            except Exception as exc:  # pylint: disable=broad-exception-caught
                return {
                    "ok": False,
                    "msg": str(exc),
                }

        @self.server.route("/api/desktop/openwindow", methods=["POST"])
        @self.noWebApp
        def openWindow():
            name = request.get_json()["name"]
            url = request.get_json()["url"]
            fullURL = f"{self.baseURL}/{url}"
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            AppDelegate().openWindow(name, fullURL)
            return "OK"

        @self.server.route("/api/getbrowserurl", methods=["GET"])
        @self.noWebApp
        @self.verifyLogin
        def getBrowserURL():
            return flask.jsonify({"url": self.baseURL})

        @self.server.route("/api/openbmode", methods=["GET"])
        @self.noWebApp
        @self.verifyLogin
        def openBrowserMode():
            from App import AppDelegate  # pylint: disable=import-outside-toplevel

            # Tokenize the url
            url = AppDelegate().tokenize(self.baseURL)
            AppDelegate().openURL(url)
            return "OK"

        @self.server.route("/api/openURL", methods=["POST"])
        @self.noWebApp
        @self.verifyLogin
        def openURL():
            from App import AppDelegate

            url = request.get_json().get("url", None)
            if url is None:
                return flask.jsonify({"ok": False, "msg": "No url provided"})

            AppDelegate().openURL(url)

            return flask.jsonify({"ok": True})

        @self.server.route("/api/version", methods=["GET"])
        @self.verifyLogin
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
        @self.verifyLogin
        def filePicker():

            jsonData = request.get_json()
            path = jsonData.get("path")
            flowContextPath = jsonData.get("flowContextPath")
            extensions = jsonData.get("extensions")
            openFolder = jsonData.get("openFolder", False)

            if extensions is not None and extensions == ["*"]:
                extensions = None

            # Handle webapp mode
            if self.webAppManager is not None:

                if flowContextPath is None:
                    return {"ok": False, "msg": "Internal server error. Try again later."}
                # If a flow context path was provided,
                # set the highest boundary to that flow folder
                path, highestBoundary = currentUser.flowContextUserPath(flowContextPath, path)

            else:
                highestBoundary = "/"
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
                fileExplorer = FileExplorer(path, highestBoundary)
                directoryContents = fileExplorer.listDirectory(
                    extensions, openFolder, relative=self.webAppManager is not None
                )
                folderChain = fileExplorer.folderChain()
                success = {
                    "ok": True,
                    "folderChain": folderChain,
                    "contents": directoryContents,
                }
            return flask.jsonify(success)

        @self.server.route("/api/filepicker/createfolder", methods=["POST"])
        @self.verifyLogin
        @self.preventOnWebApp(specialBypass="allowNewFolder")
        def createFolder():
            jsonData = request.get_json()
            path = jsonData.get("path", os.getcwd())
            folderName = jsonData.get("folderName", None)
            flowContextPath = jsonData.get("flowContextPath")

            if self.webAppManager is not None:
                if flowContextPath is None:
                    return {"ok": False, "msg": "Internal server error. Try again later."}
                # If a flow context path was provided,
                # set the highest boundary to that flow folder
                path, highestBoundary = currentUser.flowContextUserPath(flowContextPath, path)

            if folderName is None:
                return flask.jsonify({"ok": False, "msg": "No folder name provided"})

            try:
                os.makedirs(os.path.join(path, folderName))
                return flask.jsonify({"ok": True})
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/api/filepicker/upload", methods=["POST"])
        @self.verifyLogin
        @self.preventOnWebApp(specialBypass="allowUpload")
        def uploadFiles():
            path = request.form.get("path", None)
            flowContextPath = request.form.get("flowContextPath", None)
            files = request.files

            if path is None:
                return flask.jsonify({"ok": False, "msg": "No path provided"})

            if files is None:
                return flask.jsonify({"ok": False, "msg": "No file provided"})

            if self.webAppManager is not None:
                if flowContextPath is None or flowContextPath == "":
                    return {"ok": False, "msg": "Internal server error. Try again later."}
                # If a flow context path was provided,
                # set the highest boundary to that flow folder
                path, highestBoundary = currentUser.flowContextUserPath(flowContextPath, path)

            try:

                if not os.path.exists(path):
                    os.makedirs(path)

                for file in files.values():
                    if file.filename:
                        file.stream.seek(0)
                        file.save(os.path.join(path, file.filename))

                return flask.jsonify({"ok": True})
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/api/filepicker/download", methods=["POST"])
        @self.verifyLogin
        @self.preventOnWebApp(specialBypass="allowDownload")
        def downloadFiles():

            jsonData = request.get_json()
            path = jsonData.get("path", None)
            flowContextPath = jsonData.get("flowContextPath", None)

            if path is None:
                return flask.jsonify({"ok": False, "msg": "No path provided"})

            if self.webAppManager is not None:
                if flowContextPath is None or flowContextPath == "":
                    return {"ok": False, "msg": "Internal server error. Try again later."}
                # If a flow context path was provided,
                # set the highest boundary to that flow folder
                path, highestBoundary = currentUser.flowContextUserPath(flowContextPath, path)

            if os.path.isdir(path):
                # Zip the folder
                import tempfile
                import zipfile

                tempDir = tempfile.mkdtemp()
                tempZip = os.path.join(tempDir, "download.zip")

                with zipfile.ZipFile(tempZip, "w") as zipf:
                    for root, _, files in os.walk(path):
                        for file in files:
                            zipf.write(
                                os.path.join(root, file),
                                os.path.relpath(os.path.join(root, file), path),
                            )

                path = tempZip

            downloadName = os.path.basename(path)
            import mimetypes

            mimetype = mimetypes.guess_type(path)[0]

            try:
                return flask.send_file(
                    path,
                    download_name=downloadName,
                    mimetype=mimetype,
                    as_attachment=True,
                )
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/api/filepicker/delete", methods=["POST"])
        @self.verifyLogin
        @self.preventOnWebApp(specialBypass="allowDelete")
        def deleteFiles():
            data = request.get_json()
            path = data.get("path", None)
            flowContextPath = data.get("flowContextPath", None)

            if path is None:
                return flask.jsonify({"ok": False, "msg": "No path provided"})

            if self.webAppManager is not None:
                if flowContextPath is None or flowContextPath == "":
                    return {"ok": False, "msg": "Internal server error. Try again later."}
                # If a flow context path was provided,
                # set the highest boundary to that flow folder
                path, highestBoundary = currentUser.flowContextUserPath(flowContextPath, path)

            try:
                if os.path.isdir(path):
                    shutil.rmtree(path)
                else:
                    os.remove(path)

                return flask.jsonify({"ok": True})
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/api/openfolder", methods=["GET", "POST"])
        @self.verifyLogin
        def openFolder():
            if self.desktop:
                from App import AppDelegate  # pylint: disable=import-outside-toplevel

                selFolder = AppDelegate().openFolderSelectDialog()
            else:  # Implement folder picker for web/server mode
                logging.getLogger("Horus").critical(
                    "WARNING: Folder picker must call Chonky explorer instead of /api/openfolder"
                )
                selFolder = "/deprecated/method/"

            return flask.jsonify({"path": selFolder})

        @self.server.route("/api/openfile", methods=["GET", "POST"])
        @self.verifyLogin
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
        @self.verifyLogin
        @self.stopDemoUser
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
        @self.allowRemotes
        @self.verifyLogin
        def listRemotes():
            return flask.jsonify(self.remoteManager.listRemotes())

        @self.server.route("/api/remotes/names", methods=["GET"])
        @self.verifyLogin
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
        @self.allowRemotes
        @self.verifyLogin
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
        @self.allowRemotes
        @self.verifyLogin
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
        @self.verifyLogin
        def settings():
            settings = self.settingsManager.listSettings()

            return flask.jsonify({"ok": True, "settings": settings})
            # return flask.render_template("Settings/index.html")

        @self.server.route("/api/restoreSettings", methods=["GET"])
        @self.verifyLogin
        def settingsDefaults():
            self.settingsManager.restoreDefaults()

            return flask.jsonify({"ok": True})

        @self.server.route("/api/settings/<settingID>", methods=["GET"])
        @self.verifyLogin
        def setting(settingID):
            try:
                setting = self.settingsManager.getSetting(settingID)
            except Exception as exc:  # pylint: disable=broad-exception-raised
                return flask.jsonify({"ok": False, "msg": str(exc)})

            return flask.jsonify({"ok": True, "setting": setting.toDict()})

        @self.server.route("/api/saveSettings", methods=["POST"])
        @self.verifyLogin
        @self.stopDemoUser
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
        @self.verifyLogin
        def index():
            # Get the query string
            shemsu = request.args.get("shemsu", None)

            if shemsu is not None:
                if shemsu == webview.token:
                    # Starting server in browser mode
                    return flask.render_template("Main/index.html", shemsu=shemsu)

            return flask.render_template("Main/index.html")

        @self.server.route("/plugins/", methods=["GET"])
        @self.noWebApp
        @self.verifyLogin
        def pluginsManager():
            return flask.render_template("PluginsManager/index.html", shemsu=self.token)

        @self.server.route("/bmode", methods=["GET"])
        @self.noWebApp
        def bmode():
            return flask.render_template("BrowserMode/index.html")

        @self.server.route("/about", methods=["GET"])
        @self.verifyLogin
        def about():
            return flask.render_template("About/index.html", shemsu=self.token)

        @self.server.route("/remotes", methods=["GET"])
        @self.allowRemotes
        @self.noWebApp
        def remotes():
            return flask.render_template("Remotes/index.html")

        @self.server.route("/settingsview")
        @self.verifyLogin
        @self.noWebApp
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
        self.socketio = HorusSocket(
            self.server,
            self.baseURL,
            cors_allowed_origins=self.origins,
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

        from Server.PluginManager import PluginDeps

        # Create a wrapper function to add to
        # python path the plugin deps folder
        def viewFunctionWrapper(func, page, endPoint):
            @wraps(func)
            def wrapper(*args, **kwargs):
                try:
                    with PluginDeps(page._pageInfo["pluginDir"]):
                        result = PluginDeps.subprocessCall(endPoint.function, *args, **kwargs)
                    return result
                except BaseException as e:
                    logging.getLogger("Horus").error(
                        "Error in plugin endpoint %s: %s", page._pageInfo["id"], str(e)
                    )
                    return flask.jsonify({"ok": False, "msg": str(e)}), 500

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

            # If the page if for an extension /plugins/pages/...
            if "/plugins/pages/" in request.path:
                errorMSG = (
                    "If you are trying to load an extension, please "
                    + "make sure to restart the app after installing it."
                )
                horusLogger = logging.getLogger("Horus")
                horusLogger.error("Page not found: %s", str(error))

                # Log the full request
                horusLogger.error("Request: %s", str(request))

                return flask.render_template("Error/error.html", errormsg=errorMSG)

            return flask.redirect("/")

        # Setup a template not found error
        @self.server.route("/error")
        def error():
            horusLogger = logging.getLogger("Horus")
            horusLogger.error("Error page requested")

            return flask.render_template("Error/error.html")

        # For extreme cases, setup a broad exception handler
        @self.server.errorhandler(Exception)
        def exceptionHandler(error):

            if self.debug:
                error = traceback.format_exc()

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

        @self.server.route("/api/logo")
        def logo():
            # Check if there is a logo.png in the root of the current folder
            logoPath = os.path.join(os.getcwd(), "logo.png")

            if os.path.exists(logoPath):
                return flask.send_file(logoPath, mimetype="image/png")

            # If not, use the default Horus logo
            return flask.send_file(
                os.path.join(self.guiDir, "Favicon", "logo.png"),
                mimetype="image/png",
            )

    def _userRoutes(self):
        """
        Setup user routes such as registration, login...
        """

        def _loginUserInternal(user: HorusUser) -> bool:
            """
            Login the user with flask_login and set the remember session
            """

            return flask_login.login_user(user, remember=True)

        @self.server.route("/users/login", methods=["GET", "POST"])
        def login():

            if not self.webAppManager:
                return flask.redirect("/")

            # If the server does not require user registration,
            # redirect to the home page with the anonymous user
            if not self.webAppManager.userManagement.requireRegistration:
                anonyUser = HorusUser.anonymousUser(
                    self.webAppManager.userManagement.appSupportDir
                )
                _loginUserInternal(anonyUser)
                return flask.redirect("/")

            # If the user is already logged in, redirect to the home page
            if currentUser and currentUser.is_authenticated:
                # Except if the user is Demo, then logout the demo user
                # Only if we require registration
                if currentUser.isDemo and self.webAppManager.userManagement.requireRegistration:
                    flask_login.logout_user()
                    return flask.render_template("Login/login.html")

                return flask.redirect("/")

            if flask.request.method == "POST":

                data = request.get_json()

                # Get the password and mail from the form
                email = data.get("email", None)
                password = data.get("password", None)

                if email is None or password is None:
                    return flask.Response(status=400)

                db = typing.cast("Database", self.webAppManager.db)

                # Login the user
                try:
                    user = db.loginUser(email, password)

                    loggedIn = _loginUserInternal(user)

                    if not loggedIn:
                        raise UserError("Could not log in user")

                except UserError as exc:
                    return flask.jsonify({"ok": False, "msg": str(exc)})
                except Exception as exc:
                    logging.getLogger("Horus").critical("Error loging in user: %s", str(exc))
                    return flask.jsonify({"ok": False, "msg": "Internal server error"})

                logging.getLogger("Horus").info("User %s logged in", user.email)

                return flask.jsonify({"ok": True})

            return flask.render_template("Login/login.html")

        @self.server.route("/users/register", methods=["GET", "POST"])
        def register():

            if (
                not self.webAppManager
                or not self.webAppManager.userManagement.requireRegistration
            ):
                return flask.redirect("/")

            if request.method == "POST":
                # Get the data from the request
                fields = request.get_json().get("fields", None)

                if fields is None:
                    return flask.jsonify({"ok": False, "msg": "No data provided"})

                if self.webAppManager.db is None:
                    logging.getLogger("Horus").critical(
                        "A user requested to register but the database does not exist."
                    )
                    # Return an internal server error
                    return flask.Response(status=500)

                try:
                    message = self.webAppManager.db.registerUser(fields)
                    return flask.jsonify({"ok": True, "msg": message})
                except UserError as exc:
                    return flask.jsonify({"ok": False, "msg": str(exc)})
                except Exception as exc:
                    logging.getLogger("Horus").critical("Error registering in user: %s", str(exc))
                    return flask.jsonify({"ok": False, "msg": "Internal server error"})

            return flask.redirect("/login#register")

        @self.server.route("/users/logout")
        def logout():

            if (
                not self.webAppManager
                or not self.webAppManager.userManagement.requireRegistration
            ):
                return flask.redirect("/")

            if currentUser and currentUser.is_authenticated:

                logging.getLogger("Horus").debug("User %s logged out.", currentUser.email)

                flask_login.logout_user()

            return flask.redirect("/")

        @self.server.route("/users/activate", methods=["GET"])
        def activateUser():
            if not self.webAppManager or not self.webAppManager.userManagement.requireActivation:
                return flask.redirect("/")

            if self.webAppManager.db is None:
                return flask.render_template(
                    "Login/login.html", message="No user registration required", message_ok=False
                )

            # Get the activation token from the request
            token = request.args.get("token", None)

            if token is None:
                return flask.render_template(
                    "Login/login.html", message="No token provided", message_ok=False
                )

            try:
                self.webAppManager.db.activateUser(token)
                return flask.render_template(
                    "Login/login.html",
                    message="User activated, you can now log in",
                    message_ok=True,
                )
            except Exception as exc:
                return flask.render_template(
                    "Login/login.html", message=str(exc), message_ok=False
                )

        @self.server.route("/users/fields")
        def userFields():

            if self.webAppManager is None:
                return flask.jsonify({"ok": False, "msg": "No user registration required"})

            if self.webAppManager.userManagement.database is None:
                return flask.jsonify({"ok": False, "msg": "No user registration required"})

            extraFields = []
            for field in self.webAppManager.userManagement.database.extraFields:
                extraFields.append(field.toDict())

            # At the time of loading the register page, send if the user
            # has to accept the terms of service
            tosPath = os.path.join("tos.html")

            return flask.jsonify(
                {
                    "ok": True,
                    "fields": extraFields,
                    "hasTos": os.path.exists(tosPath),
                }
            )

        # Add demo user when necessary
        @self.server.route("/users/demo", methods=["GET"])
        def demoUser():
            if self.webAppManager is None:
                return flask.redirect("/")

            demoUser = HorusUser.demoUser()

            _loginUserInternal(demoUser)

            return flask.redirect("/")

        @self.server.route("/users/profile", methods=["GET", "POST"])
        def userProfile():

            if request.method == "POST":
                if (
                    not self.webAppManager
                    or not self.webAppManager.userManagement.requireRegistration
                ):
                    return flask.jsonify({"ok": True, "logged": False})

                if currentUser and currentUser.is_authenticated:

                    userDict = currentUser.toDict()

                    # Fetch the quota for the user too
                    try:
                        userDict["quota"] = (
                            self.webAppManager.db.getUserCurrentQuotasForDisplayOnUserPage(
                                currentUser
                            )
                            if self.webAppManager.db
                            else None
                        )
                    except Exception:
                        userDict["quota"] = None

                    # Send the user data
                    return flask.jsonify(
                        {
                            "user": userDict,
                            "logged": True,
                        }
                    )

                return flask.jsonify({"ok": True, "logged": False})

            return flask.redirect("/")

        @self.server.route("/users/reset", methods=["GET", "POST"])
        def resetPassword():

            if (
                self.webAppManager is None
                or self.webAppManager.userManagement.mailServer is None
                or not self.webAppManager.userManagement.requireRegistration
                or self.webAppManager.db is None
            ):
                raise Exception("No user registration required")

            if request.method == "GET":

                # If there is a token in the args, verify it and send the reset password page
                token = request.args.get("token", None)

                if token is not None:
                    try:
                        mail = self.webAppManager.userManagement.mailServer.validateToken(
                            token, self.webAppManager.db.dbConfig.secretKey
                        )
                        return flask.render_template("Login/reset.html", mail=mail)
                    except Exception:
                        return flask.render_template("Login/reset.html", mail=None)

                if not currentUser or not currentUser.is_authenticated or currentUser.isDemo:
                    return flask.jsonify({"ok": False, "msg": "Invalid user. Please log in."})
                try:
                    self.webAppManager.db.resetPassword(currentUser.email)
                    return flask.jsonify(
                        {"ok": True, "msg": "An email has been sent to reset your password"}
                    )
                except Exception as exc:
                    return flask.jsonify({"ok": False, "msg": str(exc)})

            if request.method == "POST":
                # Get the token and verify the mail
                data = request.get_json()

                token = data.get("token", None)
                newPassword = data.get("newPassword", None)

                if any(x is None for x in [token, newPassword]):
                    return flask.jsonify({"ok": False, "msg": "Missing data"})

                try:
                    self.webAppManager.db.confirmResetPassword(token, newPassword)
                    # Logout the user
                    if currentUser and currentUser.is_authenticated:
                        flask_login.logout_user()
                    return flask.jsonify({"ok": True})
                except Exception as exc:
                    return flask.jsonify({"ok": False, "msg": str(exc)})

            # Else just redirect to the home page
            return flask.redirect("/")

        @self.server.route("/users/delete", methods=["GET"])
        def deleteUser():
            if (
                not self.webAppManager
                or not self.webAppManager.userManagement.requireRegistration
                or not self.webAppManager.db
            ):
                return flask.redirect("/")

            if not currentUser or not currentUser.is_authenticated or currentUser.isDemo:
                return flask.jsonify({"ok": False, "msg": "Invalid user. Please log in."})

            try:
                self.webAppManager.db.deleteUser(currentUser.email)

                # Delete the user directory
                shutil.rmtree(currentUser.appSupportDir)

                flask_login.logout_user()
                return flask.jsonify({"ok": True})
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/users/flows", methods=["GET"])
        @self.verifyLogin
        def userFlows():
            """
            Returns the user's flows in web app mode
            """

            if self.webAppManager is None:
                return flask.jsonify({"ok": False, "msg": "No user registration required"})

            try:
                # Loop over the user's flow directory and return the .flow files
                flowInstances: typing.List["Flow"] = []
                flowDirectories = os.listdir(currentUser.flowsDir)
                for flowDir in flowDirectories:
                    flowPath = os.path.join(currentUser.flowsDir, flowDir, flowDir + ".flow")
                    if os.path.exists(flowPath):
                        flowInstances.append(self.flowManager.openFlowFromPath(flowPath))

                # If we are in webapp mode, remove the part of the paths that is not
                # accessible by the user (otside its directory)
                if self.webAppManager is not None:
                    highestBoundary = os.path.abspath(currentUser.flowsDir)
                    for flow in flowInstances:
                        flow.path = (
                            flow.path.replace(highestBoundary, "") if flow.path else flow.path
                        )

                # Convert the flows to JSON
                flows = [flow.encode() for flow in flowInstances]

                success = {"ok": True, "flows": flows}
            except Exception as exc:  # pylint: disable=broad-exception-caught
                success = {
                    "ok": False,
                    "msg": str(exc),
                }
            return flask.jsonify(success)

        @self.server.route("/users/deleteflow", methods=["POST"])
        @self.verifyLogin
        def deleteUserFlow():
            """
            Deletes a flow from the user's flows in web app mode
            """

            if self.webAppManager is None:
                return flask.jsonify({"ok": False, "msg": "No user registration required"})

            # Get the flow data
            data = request.get_json()

            if data is None:
                return flask.jsonify({"ok": False, "msg": "No data provided"})

            # Remove the flow from the database and the user's directory
            try:
                flowPath = data.get("path", None)

                if flowPath is None:
                    return flask.jsonify({"ok": False, "msg": "No path provided"})

                # Convert the path to the user's directory
                flowPath, _ = currentUser.getUserPath(flowPath)

                # Load the flow from the data
                flow = self.flowManager.openFlowFromPath(flowPath)

                # Delete the container folder of the flow
                if os.path.exists(flow.path):
                    shutil.rmtree(os.path.dirname(flow.path))
                else:
                    return flask.jsonify({"ok": False, "msg": "Flow path does not exist"})

                if self.webAppManager.db is not None:
                    self.webAppManager.db.removeFlowForUser(flow)

                return flask.jsonify({"ok": True})
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/users/downloadflow", methods=["GET", "POST"])
        @self.verifyLogin
        def downloadFlow():
            """
            Downloads a flow from the user's flows in web app mode
            """

            if self.webAppManager is None:
                return flask.jsonify({"ok": False, "msg": "No user registration required"})

            try:
                # Generate the tar
                if request.method == "POST":
                    # Get the flow path from the request
                    flowPath = request.get_json().get("path", None)

                    if flowPath is None:
                        return flask.jsonify({"ok": False, "msg": "No data provided"})
                    # Convert the path to the user's directory
                    flowPath, _ = currentUser.getUserPath(flowPath)

                    # Open the flow
                    flow = self.flowManager.openFlowFromPath(flowPath)

                    # Compress the flow
                    tarFile = self.flowManager.compressFlow(flow)

                    # Return the path of the tar file
                    return flask.jsonify({"ok": True, "path": tarFile})

                # Download the tar
                if request.method == "GET":

                    # Get the tar file from the request
                    tarFile = request.args.get("path", None)

                    if tarFile is None:
                        return flask.jsonify({"ok": False, "msg": "No data provided"})

                    # Delete the tarfile after the download
                    @flask.after_this_request
                    def removeFile(response):
                        try:
                            os.remove(tarFile)
                        except Exception as exc:
                            logging.getLogger("Horus").error(
                                "Error removing file {%s}: {%s}",
                                tarFile,
                                str(exc),
                            )
                        return response

                    # Return the flow as a blob
                    return flask.send_file(
                        tarFile,
                        as_attachment=True,
                        mimetype="application/octet-stream",
                    )
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

            return flask.jsonify({"ok": False, "msg": "Invalid request"})

        @self.server.route("/users/admintools")
        @self.verifyLogin
        @self.verifyAdmin
        def adminTools():
            return flask.render_template("Login/admintools.html")

        @self.server.route("/users/admintools/data", methods=["GET"])
        @self.verifyLogin
        @self.verifyAdmin
        def adminData():

            if not self.webAppManager or self.webAppManager.db is None:
                return flask.jsonify({"ok": False, "msg": "No user registration required"})

            # Return the database info
            return flask.jsonify(self.webAppManager.db.dumpDatabase())

        @self.server.route("/users/admintools/modifyuser", methods=["POST"])
        @self.verifyLogin
        @self.verifyAdmin
        def modifyUserAdminTools():

            if not self.webAppManager or self.webAppManager.db is None:
                return flask.jsonify({"ok": False, "msg": "No user registration required"})

            # Update the user
            user = request.get_json()

            if user is None:
                return flask.jsonify({"ok": False, "msg": "No user provided"})

            try:

                # Parse the user to get only the fields that can be modified
                userID = user.get("id", None)
                newQuota = {
                    "maxFlows": user.get("maxFlows", None),
                    "maxStorage": user.get("maxStorage", None),
                    "maxTime": user.get("maxTime", None),
                }

                # If any of the data is None, raise
                if any(
                    x is None
                    for x in [
                        userID,
                        newQuota["maxFlows"],
                        newQuota["maxStorage"],
                        newQuota["maxTime"],
                    ]
                ):
                    raise Exception("Missing data")

                self.webAppManager.db.updateUserQuotas(userID, newQuota)
                return flask.jsonify({"ok": True})
            except Exception as exc:
                return flask.jsonify({"ok": False, "msg": str(exc)})

        @self.server.route("/tos")
        def tos():

            # If there is a tos.html file, render it
            tosPath = os.path.abspath("tos.html")

            if os.path.exists(tosPath):
                return flask.send_file(tosPath)

            # Otherwise just redirect to the home page
            return flask.redirect("/")

    def run(self, reloader: bool = False):
        """
        Runs the server using the socketio.run method
        """
        # use_reloader has to be turned off in order to run in a secondary thread

        if not self.desktop:
            print(f"Running {self.mode} mode at: " + self.baseURL)

        # Define the arguments for socketio.run
        runArgs = {
            "host": self.host,
            "port": self.port,
            "debug": self.debug,
            "use_reloader": reloader,
            "log_output": self.debug,
        }

        # Start the server if not on web app mode
        self.socketio.run(self.server, **runArgs)

    _maxConcurrentFlows: int = 1
    """
    The maximum number of concurrent flows that the server can run
    """

    _taskSemaphore: Semaphore
    """
    A semaphore to queue the background tasks
    according to the number of cores
    """

    def _setupSemaphore(self):
        """
        Assings the maxConcurrentFlows to the semaphore
        """

        # Read from the general settings the maximum number of concurrent flows
        automatic = self.settingsManager.getSetting("automaticConcurrentFlows").value

        # Assign the maximum number of running flows
        maxConcurrentFlows = 1  # Default to 1

        if automatic:
            try:
                maxConcurrentFlows = len(os.sched_getaffinity(0)) - 1  # type: ignore
            except AttributeError:
                maxConcurrentFlows = multiprocessing.cpu_count() - 1
        else:
            # Read from the general settings the maximum number of concurrent flows
            maxConcurrentFlows = self.settingsManager.getSetting("maxConcurrentFlows").value

        # Make sure we have at least one flow, even on potato computers
        self._maxConcurrentFlows = maxConcurrentFlows if maxConcurrentFlows > 0 else 1

        self.taskSemaphore = Semaphore(self._maxConcurrentFlows)
        logging.getLogger("Horus").info(
            "Maximum number of concurrent flows: %s", maxConcurrentFlows
        )

    def backgroundRun(self, func: typing.Callable):
        """
        Runs the given function in a background process. This function requires
        an active request context.

        :param func: The function to run in the background
        """

        # Define a function to run the request on
        def requestRunner(environment, semaphore):
            with semaphore:
                with self.server.request_context(environment):
                    func()

        # Start a new process for the flowRunner function
        process = Process(  # pylint: disable=not-callable
            target=requestRunner, args=(request.environ, self.taskSemaphore)
        )

        # Start the process
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

    def run(self, server, **runArgs):

        def hook_get_logger(*args):
            return logging.getLogger("eventlet")

        # Inject the Horus logger as the eventlet logger
        eventlet.wsgi.get_logger = hook_get_logger

        super().run(server, **runArgs)

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

                    def sendRequest():
                        requests.post(
                            f"{self.baseURL}/internal/backgroundsocketio/",
                            json=data,
                            timeout=1,
                        )

                    # Send the request and wait for it to finish 1 second
                    timer = threading.Thread(target=sendRequest)
                    timer.start()
                    timer.join(1)
                except requests.exceptions.RequestException:
                    logging.getLogger("Horus").error(
                        "Could not connect to server with requests to emit event %s", event
                    )

                # Exit the function
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

            # Append only if not already in the list
            if flowID not in self.joinedRooms[sid]:
                self.joinedRooms[sid].append(flowID)

        @self.on("leaveFlow")
        def leaveFlow(flowID):
            sid = request.sid  # type: ignore

            if flowID is None:
                # Do nothing
                return

            # Leave the flow room
            leave_room(flowID)

            if sid in self.joinedRooms:
                if flowID in self.joinedRooms[sid]:
                    self.joinedRooms[sid].remove(flowID)

            logging.getLogger("Horus").debug("Left room for flowID %s", flowID)

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

        # Add some debugging routes
        @self.on("getRoom")
        def getRoom(data):
            """
            Returns the room where the current client is
            """

            sid = request.sid  # type: ignore
            return self.joinedRooms.get(sid, None)

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
