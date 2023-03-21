import webview


def molstar_window():
    window = webview.create_window('Molstar', "App/molstar/molstar.html")
    return window
