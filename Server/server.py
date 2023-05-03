# Tools
import json
import os
from functools import wraps

# Flask
import flask

# PyWebview
import webview


# Check if the GUI is in the development path or in the frozen executable path
def guiDir():
    gui_dir = os.path.join(os.path.dirname(__file__), "..", "Gui")
    print("Gui dir is: " + gui_dir)
    if not os.path.exists(gui_dir):  # frozen executable path
        gui_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Gui")
        print("Frozen executable, trying Gui dir: " + gui_dir)
    
    if not os.path.exists(gui_dir):
        gui_dir = os.path.join(os.path.abspath(os.curdir), "Gui")
        print("Gui dir still not found, trying current dir: " + gui_dir)

    return gui_dir


server = flask.Flask(
    __name__,
    static_folder=guiDir(),
    template_folder=guiDir(),
    static_url_path="/",
)


def verify_token(function):
    @wraps(function)
    def wrapper(*args, **kwargs):
        # Load the token from the request header
        token = flask.request.headers.get("shemsu")
        if token == webview.token:
            return function(*args, **kwargs)
        else:
            raise Exception("Authentication error")

    return wrapper


@server.after_request
def add_header(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@server.route("/api/data", methods=["GET"])
@verify_token
def test_token():
    return flask.jsonify({"data": "Hello from Flask!"})


@server.route("/")
def index():
    # Init the webview with the token
    # Log the template folder
    print("Template folder is: " + server.template_folder)
    return flask.render_template("index.html", shemsu=webview.token)
