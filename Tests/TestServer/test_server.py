import pytest
from Server import HorusServer
from multiprocess import Process  # type: ignore pylint: disable=no-name-in-module
import requests
import time

# Re init the PluginManager
# WARNING: NOT NEEDED ANYMORE
# Plus, this line was making other tests, outside this file,
# to fail. The initial AppDelegate tests: test_launch_app_not_compiled and test_launch_app_compiled
# failed because of this line. I commented it out and the tests passed.
# PluginManager("AppSupport").appSupportDir = "AppSupport"


@pytest.fixture
def desktopServer():
    return HorusServer(mode="app", port=3124)


@pytest.fixture
def server():
    return HorusServer(mode="server")


def test_desktop_server_init(desktopServer):
    assert desktopServer.debug is False
    assert desktopServer.host == "localhost"
    assert 3124 <= desktopServer.port <= 9000
    assert desktopServer.pluginManager is not None


def test_get_free_port(desktopServer):
    port = desktopServer._getFreePort()
    assert isinstance(port, int)
    assert 3000 <= port <= 9000


def test_gui_dir(desktopServer):
    gui_dir = desktopServer._guiDir()
    assert isinstance(gui_dir, str)


def test_gui_dir_debug_mode_parcel_not_running(mocker):
    # Create an instance of HorusServer with debug and parcelURL set to True
    server = HorusServer(debug=True)

    # Mock os.path.abspath and os.path.join
    mocker.patch(
        "os.path.abspath", side_effect=lambda x: x
    )  # No actual path joining, just return the input
    mocker.patch(
        "os.path.join", side_effect=lambda *args: "/".join(args)
    )  # Join path components with a "/"

    # Patch the os.path.exists method to simulate the GUI directory being found
    mocker.patch("os.path.exists", return_value=True)

    # Mock the os.path.dirname method to simulate a module
    mocker.patch("os.path.dirname", return_value="/path/to/your_executable")

    # Mock the sys._MEIPASS attribute to simulate a frozen executable environment
    mocker.patch("sys._MEIPASS", "/path/to/your_executable", create=True)

    # Call the _guiDir method
    gui_dir = server._guiDir()

    # Assert that the GUI directory is constructed as expected
    assert gui_dir == "/path/to/your_executable/GUI"


def test_gui_dir_frozen_executable(mocker):
    # Create an instance of HorusServer with debug and parcelURL set to False
    server = HorusServer(debug=False, port=3124)

    # Mock os.path.abspath and os.path.join
    mocker.patch(
        "os.path.abspath", side_effect=lambda x: x
    )  # No actual path joining, just return the input
    mocker.patch(
        "os.path.join", side_effect=lambda *args: "/".join(args)
    )  # Join path components with a "/"

    # Patch the os.path.exists method to simulate the GUI directory being found
    mocker.patch("os.path.exists", return_value=True)

    # Mock the os.path.dirname method to simulate a module
    mocker.patch("os.path.dirname", return_value="/path/to/your_executable")

    # Mock the sys._MEIPASS attribute to simulate a frozen executable environment
    mocker.patch("sys._MEIPASS", "/path/to/your_executable", create=True)

    # Call the _guiDir method
    gui_dir = server._guiDir()

    # Assert that the GUI directory is constructed as expected for a frozen executable
    assert gui_dir == "/path/to/your_executable/GUI"


def test_gui_dir_not_frozen_executable(mocker):
    # Create an instance of HorusServer with debug and parcelURL set to False
    server = HorusServer(debug=False, port=3124)

    # Mock os.path.abspath and os.path.join
    mocker.patch(
        "os.path.abspath", side_effect=lambda x: x
    )  # No actual path joining, just return the input

    # Mock the os.path.dirname method to simulate a module
    mocker.patch("os.path.dirname", return_value="/path/to/your_executable")

    # Call the _guiDir method without mocking sys._MEIPASS to simulate
    # a non-frozen executable environment
    with pytest.raises(Exception, match="GUI directory not found"):
        server._guiDir()


def test_get_token_desktop(mocker):
    # Create an instance of HorusServer with desktop set to True
    server = HorusServer(mode="app", port=3124)

    # Mock the webview module and its token attribute
    mocked_token = "mocked_token"
    mocker.patch("webview.token", mocked_token)

    # Call the _getToken method
    token = server._getToken()

    # Assert that the token returned is the mocked value
    assert token == mocked_token


def test_get_token_no_desktop(mocker):
    # Create an instance of HorusServer with desktop set to False
    server = HorusServer(mode="server", port=3124)

    # Call the _getToken method
    token = server._getToken()

    # Assert that the token is a string containing only digits
    assert token.isdigit()


def test_tokenize():
    server = HorusServer(port=3124)

    test_string = "Hello, World!"

    # Test tokenization of a string
    assert isinstance(server.tokenManager.tokenize(test_string), str)


def test_checkToken():
    # Create an instance of TokenManager with a specific salt
    server = HorusServer(port=3124)

    # Test token verification for a valid token
    test_string = "Hello, World!"
    token = server.tokenManager.tokenize(test_string)
    assert server.tokenManager.checkToken(token, test_string) is True

    # Test token verification for an invalid token
    invalid_token = "invalid_token"
    assert server.tokenManager.checkToken(invalid_token, test_string) is False


def test_run_server_mode_production():
    server = HorusServer(mode="server", debug=False)

    # Define a function to run the test
    def run_test():
        # Call the run method with reloader set to False
        server.run(reloader=False)

    # Create a new thread and start it
    process = Process(target=run_test)
    process.start()

    # Wait for the server to start
    time.sleep(1)

    # Check that the server is running
    requests.get(server.baseURL, timeout=1)

    # Wait for the process to finish
    process.kill()


def test_run_server_mode_debug():
    server = HorusServer(mode="server", debug=True)

    # Define a function to run the test
    def run_test():
        # Call the run method with reloader set to False
        server.run(reloader=False)

    # Create a new thread and start it
    process = Process(target=run_test)
    process.start()

    # Wait for the server to start
    time.sleep(1)

    # Check that the server is running
    requests.get(server.baseURL, timeout=1)

    # Wait for the process to finish
    process.kill()


def test_run_app_mode_debug():
    server = HorusServer(mode="app", debug=True)

    # Define a function to run the test
    def run_test():
        # Call the run method with reloader set to False
        server.run(reloader=False)

    # Create a new thread and start it
    process = Process(target=run_test)
    process.start()

    # Wait for the server to start
    time.sleep(1)

    # Check that the server is running
    requests.get(server.baseURL, timeout=1)

    # Wait for the process to finish
    process.kill()


def test_run_app_mode_production():
    server = HorusServer(mode="app", debug=False)

    # Define a function to run the test
    def run_test():
        # Call the run method with reloader set to False
        server.run(reloader=False)

    # Create a new thread and start it
    process = Process(target=run_test)
    process.start()

    # Wait for the server to start
    time.sleep(1)

    # Check that the server is running
    requests.get(server.baseURL, timeout=1)

    # Wait for the process to finish
    process.kill()
