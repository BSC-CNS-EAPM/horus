from Server import PluginManager
from HorusAPI import Plugin
import os
import sys
import pytest
from unittest.mock import MagicMock
import shutil


@pytest.fixture
def pluginManager():
    return PluginManager("AppSupport", False)


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


def test_plugins_deps_dir_creation(mocker):
    # Create an instance of PluginManager
    pluginManager = PluginManager("AppSupport", False)

    # Mock os.path and sys._MEIPASS
    mocker.patch("os.path.join", side_effect=lambda *args: "/".join(args))
    mocker.patch(
        "os.path.exists", side_effect=lambda x: False
    )  # Mock directory not existing
    mocker.patch("os.mkdir")  # Mock the os.mkdir function

    # Call the _pluginsDepsDir method
    app_support_dir = "/path/to/app_support"
    pluginManager._pluginsDepsDir(app_support_dir)

    # Assert that the directories are created correctly and paths are set
    assert pluginManager.defaultPluginsDir == "/path/to/app_support/DefaultPlugins"
    assert pluginManager.pluginsDir == "/path/to/app_support/Plugins"
    assert pluginManager.depsDir == "/path/to/app_support/Dependencies"

    os.mkdir.assert_has_calls(
        [
            mocker.call("/path/to/app_support/Plugins"),
            mocker.call("/path/to/app_support/Dependencies"),
        ]
    )

    # Assert if the last sus.path.append call is correct
    assert sys.path[-1] == "/path/to/app_support/Dependencies"


def test_install_plugin_success(mocker):
    # Create an instance of PluginManager
    pluginManager = PluginManager("AppSupport", False)

    # Mock os.path and os.mkdir
    mocker.patch("os.path.basename", return_value="my_plugin.hp")
    mocker.patch("os.path.splitext", return_value=("my_plugin", ".hp"))
    mocker.patch("os.path.exists", return_value=False)  # Plugin directory doesn't exist
    mocker.patch("os.mkdir")  # Mock the os.mkdir function
    mocker.patch("os.remove")  # Mock the os.remove function
    mocker.patch("shutil.copy", return_value="/path/to/new_plugin.hp")

    # Mock the _loadPlugin method
    mocker.patch.object(pluginManager, "_loadPlugin")

    # Mock the zipfile.ZipFile context manager and its methods
    mock_zipfile = MagicMock()
    mock_zipfile.extractall = mocker.Mock()
    mock_zipfile.__enter__ = mocker.Mock(return_value=mock_zipfile)
    mock_zipfile.__exit__ = mocker.Mock(return_value=None)
    mocker.patch("zipfile.ZipFile", return_value=mock_zipfile)

    # Call the _installPlugin method
    plugin_path = "/path/to/my_plugin.hp"
    pluginManager.pluginsDir = "/path/to/plugins"
    pluginManager._installPlugin(plugin_path)

    # Assert that the plugin directory is created,
    # shutil.copy is called, and zipfile is extracted
    os.mkdir.assert_called_once_with("/path/to/plugins/my_plugin")
    shutil.copy.assert_called_once_with(plugin_path, "/path/to/plugins/my_plugin")
    mock_zipfile.extractall.assert_called_once_with("/path/to/plugins/my_plugin")

    # Assert that the .hp file is removed
    os.remove.assert_called_once_with("/path/to/new_plugin.hp")


def test_install_plugin_load_failure(mocker):
    # Create an instance of PluginManager
    pluginManager = PluginManager("AppSupport", False)

    # Create a mock plugin file
    pluginPath = "Tests/TestPluginManager/test_plugin.py"
    with open(pluginPath, "w") as f:
        f.write("from HorusAPI import Plugin\nplugin = PluginTypo(id='test')")

    try:
        pluginManager._checkPlugin(pluginPath)

        # If the plugin is valid, raise an exception
        raise Exception(
            "Plugin should not be valid but passed tests. Check the _checkPlugin method"
        )

    except Exception as e:
        assert "PluginTypo" in str(e)

    # Remove the mock plugin file
    os.remove(pluginPath)
