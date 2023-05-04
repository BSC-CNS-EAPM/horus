# Tools
import json
import os
from functools import wraps

# Flask
import flask
from flask import request

# PyWebview
import webview


class HorusServer:
    host = "localhost"
    port = 5050
    url = f"http://{host}:{port}"

    def __init__(self, debug=False):
        self.debug = debug
        self.guiDir = self.__guiDir()
        self.server = self.__setupServer()
        self.__routes()

    def __guiDir(self):
        """
        Checks for the Gui directory in the following order:
        1. The parent directory of the current file (development)
        2. The parent directory of the current file (frozen executable pyinstaller)
        3. The current directory (frozen executable py2app)
        """
        gui_dir = os.path.join(os.path.dirname(__file__), "..", "Gui")
        if not os.path.exists(gui_dir):  # frozen executable path
            gui_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Gui")
        if not os.path.exists(gui_dir):
            gui_dir = os.path.join(os.path.abspath(os.curdir), "Gui")

        return gui_dir

    def __setupServer(self):
        return flask.Flask(
            __name__,
            static_folder=self.guiDir,
            template_folder=self.guiDir,
            static_url_path="/",
        )

    def __routes(self):
        def verify_token(function):
            @wraps(function)
            def wrapper(*args, **kwargs):
                # Load the token from the request header
                token = flask.request.headers.get("shemsu")
                if token == webview.token:
                    return function(*args, **kwargs)
                else:
                    return "Access denied"

            return wrapper

        @self.server.after_request
        def add_header(response):
            response.headers["Cache-Control"] = "no-store"
            return response

        @self.server.route("/api/data", methods=["GET"])
        @verify_token
        def test_token():
            return flask.jsonify({"data": "Hello from Flask!"})

        @self.server.route("/")
        @verify_token
        def index():
            # Init the webview with the token
            # Log the template folder
            return flask.render_template("index.html")

    def run(self):
        self.server.run(
            host=self.host, port=self.port, debug=self.debug, use_reloader=False
        )
