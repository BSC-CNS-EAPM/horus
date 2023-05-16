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
        self.debug = debug
        self.host = "127.0.0.1"
        self.port = self.__getFreePort()
        self.baseURL = f"http://{self.host}:{self.port}"
        self.desktop = desktop
        self.token = self.__cors()
        self.guiDir = self.__guiDir()
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
            parcel = requests.get(self.parcelURL)
        except requests.exceptions.ConnectionError:
            return False
        if parcel.status_code == 200:
            print("\n<========Using parcel development server...========>\n")
            return True

    def __guiDir(self):
        """
        Checks for the GUI directory in the following order:
        1. The parent directory of the current file (development)
        2. The parent directory of the current file (frozen executable pyinstaller)
        3. The current directory (frozen executable py2app)
        """

        # Development path
        gui_dir = os.path.join(os.path.dirname(__file__), "..", "GUI")

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
            print("\n<========Enabling CORS...========>\n")
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
            # Check if the parcel server is running:
            # if self.debug and self.__checkParcel():
            #     return flask.redirect(self.parcelURL)

            # Otherwise, load the index file from the local folder:
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
