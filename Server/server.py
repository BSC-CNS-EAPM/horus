# Tools
import json
import os
import sys
from functools import wraps
import logging

# Flask
import flask
from flask import request

# PyWebview
import webview

# Import random to generate a random port number
import random


class HorusServer:
    def __init__(self, debug=False):
        self.host = "localhost"
        self.port = self.__getFreePort()
        self.baseURL = f"http://{self.host}:{self.port}"
        self.tokenURL = f"{self.baseURL}/?shemsu={webview.token}"
        self.debug = debug
        self.guiDir = self.__guiDir()
        self.server = self.__setupServer()
        self.__routes()

    def __getFreePort(self):
        port = random.randint(5001, 9000)

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
        parcelURL = "http://localhost:1234"

        import requests

        try:
            parcel = requests.get(parcelURL)
        except requests.exceptions.ConnectionError:
            return None
        if parcel.status_code == 200:
            print("\n<========Using parcel development server...========>\n")
            return flask.redirect(parcelURL)

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
            bundle_dir = sys._MEIPASS
            gui_dir = os.path.abspath(os.path.join(bundle_dir, "GUI"))
            print(gui_dir)

        # Error if the GUI directory is not found
        if not os.path.exists(gui_dir):
            raise Exception("GUI directory not found")

        return gui_dir

    def __setupServer(self):
        """
        Creates the Flask server instance. This will serve the GUI files and handle the API requests. Also disabled Flask logging when not in debug mode.
        """
        # Disable werkzeug logging when not in debug mode
        logging.getLogger("werkzeug").disabled = not self.debug

        # Setup the server
        return flask.Flask(
            __name__,
            static_folder=self.guiDir,
            template_folder=self.guiDir,
            static_url_path="/",
        )

    def __routes(self):
        # Setup the error page
        @self.server.errorhandler(404)
        def page_not_found(e):
            return "Page not found"

        @self.server.route("/api/data", methods=["GET"])
        def test_token():
            print("Seding data")
            return flask.jsonify({"data": "Hello from Flask!"})

        @self.server.route("/")
        def index():
            # Check if the parcel server is running:
            if self.debug:
                parcel = self.__checkParcel()
                if parcel is not None:
                    return parcel

            # Otherwise, load the index file from the local folder:
            return flask.render_template("index.html")

        @self.server.before_request
        def before_request():
            if not self.debug:
                # Load the token from the request args or headers
                token = request.args.get("shemsu")
                if token is None:
                    token = request.headers.get("shemsu")

                # Check that the token is valid
                if token == webview.token:
                    pass
                else:
                    return "Access denied"
            pass

        @self.server.after_request
        def add_header(response):
            # Disable caching
            response.headers["Cache-Control"] = "no-store"
            return response

    def run(self):
        self.server.run(
            host=self.host, port=self.port, debug=self.debug, use_reloader=False
        )
