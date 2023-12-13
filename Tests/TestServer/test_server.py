import pytest
from Server import HorusServer
from multiprocess import Process  # type: ignore pylint: disable=no-name-in-module
import requests
import time
import sys

from Server.PluginManager import PluginManager

# Re init the PluginManager
PluginManager("AppSupport").appSupportDir = "AppSupport"


@pytest.fixture
def desktopServer():
    return HorusServer(desktop=True, port=3000)


@pytest.fixture
def server():
    return HorusServer(desktop=False)


def test_desktop_server_init(desktopServer):
    assert desktopServer.debug is False
    assert desktopServer.host == "localhost"
    assert 3000 <= desktopServer.port <= 9000
    assert desktopServer.pluginManager is not None


def test_get_free_port(desktopServer):
    port = desktopServer._getFreePort()
    assert isinstance(port, int)
    assert 3000 <= port <= 9000


def test_gui_dir(desktopServer):
    gui_dir = desktopServer._guiDir()
    assert isinstance(gui_dir, str)


def test_gui_dir_debug_mode_parcel_running(mocker):
    # Create an instance of HorusServer with debug and parcelURL set to True
    server = HorusServer(debug=True)
    server._checkParcel = mocker.Mock(return_value=True)

    # Mock os.path.abspath and os.path.join
    mocker.patch(
        "os.path.abspath", side_effect=lambda x: x
    )  # No actual path joining, just return the input
    mocker.patch(
        "os.path.join", side_effect=lambda *args: "/".join(args)
    )  # Join path components with a "/"

    # Mock the os.path.dirname method to simulate a module
    mocker.patch("os.path.dirname", return_value="/path/to/your_module")

    # Call the _guiDir method
    gui_dir = server._guiDir()

    # Assert that the GUI directory is constructed as expected
    assert gui_dir == "/path/to/your_module/../dist"


def test_gui_dir_debug_mode_parcel_not_running(mocker):
    # Create an instance of HorusServer with debug and parcelURL set to True
    server = HorusServer(debug=True)
    server._checkParcel = mocker.Mock(return_value=False)

    # Mock os.path.abspath and os.path.join
    mocker.patch(
        "os.path.abspath", side_effect=lambda x: x
    )  # No actual path joining, just return the input
    mocker.patch(
        "os.path.join", side_effect=lambda *args: "/".join(args)
    )  # Join path components with a "/"

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
    server = HorusServer(debug=False, port=3000)

    # Mock os.path.abspath and os.path.join
    mocker.patch(
        "os.path.abspath", side_effect=lambda x: x
    )  # No actual path joining, just return the input
    mocker.patch(
        "os.path.join", side_effect=lambda *args: "/".join(args)
    )  # Join path components with a "/"

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
    server = HorusServer(debug=False, port=3000)

    # Mock os.path.abspath and os.path.join
    mocker.patch(
        "os.path.abspath", side_effect=lambda x: x
    )  # No actual path joining, just return the input

    # Mock the os.path.dirname method to simulate a module
    mocker.patch("os.path.dirname", return_value="/path/to/your_executable")

    # Call the _guiDir method without mocking sys._MEIPASS to simulate
    # a non-frozen executable environment
    with pytest.raises(Exception, match="App not frozen and GUI directory not found"):
        server._guiDir()


def test_get_token_desktop(mocker):
    # Create an instance of HorusServer with desktop set to True
    server = HorusServer(desktop=True, port=3000)

    # Mock the webview module and its token attribute
    mocked_token = "mocked_token"
    mocker.patch("webview.token", mocked_token)

    # Call the _getToken method
    token = server._getToken()

    # Assert that the token returned is the mocked value
    assert token == mocked_token


def test_get_token_no_desktop(mocker):
    # Create an instance of HorusServer with desktop set to False
    server = HorusServer(desktop=False, port=3000)

    # Call the _getToken method
    token = server._getToken()

    # Assert that the token is a string containing only digits
    assert token.isdigit()


def test_check_parcel_server_running(mocker):
    # Create an instance of HorusServer with a mock parcel URL
    server = HorusServer(port=3000)

    # Mock requests.get to simulate a successful response
    mocker.patch("requests.get", side_effect=lambda *args, **kwargs: mocker.Mock())

    # Call the _checkParcel method
    result = server._checkParcel()

    # Assert that the result is True when the parcel server is running
    assert result is True


def test_check_parcel_server_not_running(mocker):
    # Create an instance of HorusServer with a mock parcel URL
    server = HorusServer(port=3000)

    # Mock requests.get to simulate a ConnectionError
    # when trying to connect to the parcel server
    from requests.exceptions import ConnectionError

    mocker.patch("requests.get", side_effect=ConnectionError)

    # Call the _checkParcel method
    result = server._checkParcel()

    # Assert that the result is False when the parcel server is not running
    assert result is False


def test_tokenize():
    server = HorusServer(port=3000)

    test_string = "Hello, World!"

    # Test tokenization of a string
    assert isinstance(server.tokenManager.tokenize(test_string), str)


def test_checkToken():
    # Create an instance of TokenManager with a specific salt
    server = HorusServer(port=3000)

    # Test token verification for a valid token
    test_string = "Hello, World!"
    token = server.tokenManager.tokenize(test_string)
    assert server.tokenManager.checkToken(token, test_string) is True

    # Test token verification for an invalid token
    invalid_token = "invalid_token"
    assert server.tokenManager.checkToken(invalid_token, test_string) is False


def test_run_server_mode_production():
    server = HorusServer(desktop=False, debug=False)

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
    server = HorusServer(desktop=False, debug=True)

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
    server = HorusServer(desktop=True, debug=True)

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
    server = HorusServer(desktop=True, debug=False)

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
