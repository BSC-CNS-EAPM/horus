# Add to the pythonpath the path of the project
import sys

sys.path.append("../")

if __name__ == "__main__":
    # Import the server from Backend/server.py

    from Server import server as flask_server

    import webview

    window = webview.create_window(
        "Horus",
        flask_server
    )

    webview.start(debug=True)

