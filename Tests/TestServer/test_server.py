import pytest
from Server import HorusServer
from Server import PluginManager
from HorusAPI import Plugin
import os


@pytest.fixture
def desktopServer():
    return HorusServer(desktop=True)


@pytest.fixture
def server():
    return HorusServer(desktop=False)


@pytest.fixture
def pluginManager():
    return PluginManager("AppSupport", False)


def test_desktop_server_init(desktopServer):
    assert desktopServer.debug is False
    assert desktopServer.host == "127.0.0.1"
    assert 5001 <= desktopServer.port <= 9000
    assert desktopServer.pluginManager is not None


def test_get_free_port(desktopServer):
    port = desktopServer._getFreePort()
    assert isinstance(port, int)
    assert 5001 <= port <= 9000


def test_gui_dir(desktopServer):
    gui_dir = desktopServer._guiDir()
    assert isinstance(gui_dir, str)


def test_checkPlugin(pluginManager):
    # Create a mock plugin file
    pluginPath = "Tests/TestServer/test_plugin.py"
    with open(pluginPath, "w") as f:
        f.write("from HorusAPI import Plugin\nplugin = Plugin(id='test')")

    # Call the _checkPlugin function
    plugin = pluginManager._checkPlugin(pluginPath)

    # Clean up the mock plugin file
    os.remove(pluginPath)

    # Check that the plugin is valid
    assert plugin is not None
    assert isinstance(plugin, Plugin)
    assert plugin.info["name"] == "Plugin"
    assert plugin.info["version"] == "0.0.1"
    assert plugin.info["author"] == "None"
    assert plugin.info["description"] == "None"
    assert plugin.info["dependencies"] == ["None"]

    # Check that the comparison operators work
    assert plugin == plugin
