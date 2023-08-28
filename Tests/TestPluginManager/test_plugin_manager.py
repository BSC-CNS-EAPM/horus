from Server.PluginManager import PluginManager
from HorusAPI import Plugin
import os
import sys
import pytest
from unittest.mock import MagicMock
import shutil
import subprocess
from unittest.mock import patch


@pytest.fixture
def pluginManager():
    return PluginManager("AppSupport", False)


def test_checkPlugin(pluginManager):
    # Create a mock plugin file
    entryPath = "Tests/TestServer/test_plugin.py"
    with open(entryPath, "w") as f:
        f.write("from HorusAPI import Plugin\nplugin = Plugin(id='test')")

    pluginDir = "Tests/TestServer"

    metaPath = "Tests/TestServer/plugin.meta"
    with open(metaPath, "w") as f:
        f.write(
            """
{
  "name": "TestPlugin",
  "description": "The test plugin for Horus",
  "author": "Nostrum Biodiscovery",
  "version": "0.0.1",
  "pluginFile": "test_plugin.py",
  "dependencies": []
}"""
        )
    try:
        # Call the _checkPlugin function
        plugin = pluginManager._checkPlugin(pluginDir)
    except Exception as e:
        raise e
    finally:
        # Clean up the mock plugin file
        os.remove(entryPath)
        os.remove(metaPath)

    # Check that the plugin is valid
    assert plugin is not None
    assert isinstance(plugin, Plugin)
    assert plugin.info["name"] == "TestPlugin"
    assert plugin.info["version"] == "0.0.1"
    assert plugin.info["author"] == "Nostrum Biodiscovery"
    assert plugin.info["description"] == "The test plugin for Horus"
    assert plugin.info["dependencies"] == []

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

    os.mkdir.assert_has_calls(
        [
            mocker.call("/path/to/app_support/Plugins"),
        ]
    )


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
    mocker.patch("shutil.move")  # Mock the move function

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

    loadedPlugin = pluginManager._loadPlugin(plugin_path)

    if loadedPlugin is None:
        raise Exception("Failed to install a plugin TEST")

    finalPath = os.path.join(pluginManager.pluginsDir, loadedPlugin.id)

    # Assert that the plugin directory is created,
    # shutil.copy is called, and zipfile is extracted
    os.mkdir.assert_called_once_with("/path/to/plugins/tmpInstall")
    shutil.copy.assert_called_once_with(plugin_path, "/path/to/plugins/tmpInstall")
    mock_zipfile.extractall.assert_called_once_with("/path/to/plugins/tmpInstall")
    shutil.move.assert_called_once_with("/path/to/plugins/tmpInstall", finalPath)

    # Assert that the .hp file is removed
    os.remove.assert_called_once_with("/path/to/new_plugin.hp")


def test_install_plugin_load_failure(mocker):
    # Create an instance of PluginManager
    pluginManager = PluginManager("AppSupport", False)

    # Create a mock plugin file and metadata file
    pluginPath = "Tests/TestPluginManager/test_plugin.py"
    with open(pluginPath, "w") as f:
        f.write("from HorusAPI import Plugin\nplugin = PluginTypo(id='test')")

    pluginDir = "Tests/TestPluginManager"

    metaPath = "Tests/TestPluginManager/plugin.meta"
    with open(metaPath, "w") as f:
        f.write(
            """
{
  "name": "TestPlugin",
  "description": "The Test plugin for Horus",
  "author": "Nostrum Biodiscovery",
  "version": "0.0.1",
  "pluginFile": "test_plugin.py",
  "dependencies": []
}"""
        )

    try:
        pluginManager._checkPlugin(pluginDir)

        # If the plugin is valid, raise an exception
        raise Exception(
            "Plugin should not be valid but passed tests. Check the _checkPlugin method"
        )

    except Exception as e:
        assert "PluginTypo" in str(e)
    finally:
        # Remove the mock plugin file
        os.remove(pluginPath)
        os.remove(metaPath)


def test_install_dep_internal_success(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport", False)

    # Mock the subprocess.Popen context manager
    mock_popen = mocker.Mock()
    mock_popen.returncode = 0
    mocker.patch("subprocess.Popen", return_value=mock_popen)

    # Mock the with ... as ... statement for popen
    mock_popen.__enter__ = mocker.Mock(return_value=mock_popen)
    mock_popen.__exit__ = mocker.Mock(return_value=None)

    mock_popen.stdout.read.return_value = b"Python 3.9.16"

    # Call the _installDepInternal method
    dep_to_install = "dep"
    deps_dir = "/path/to/dependencies"

    with pytest.raises(Exception, match="'Mock' object is not iterable"):
        pluginManager._installDepInternal(dep_to_install, deps_dir)

    # Check the arguments of the last call to subprocess.Popen
    last_call_args, last_call_kwargs = subprocess.Popen.call_args  # type: ignore
    assert last_call_args[0] == [
        "python",
        "-m",
        "pip",
        "install",
        "dep",
        "--target",
        "/path/to/dependencies",
        "--upgrade",
        "--no-input",
    ]
    assert last_call_kwargs["stdout"] == subprocess.PIPE
    assert last_call_kwargs["stderr"] == subprocess.STDOUT
    assert last_call_kwargs["stdin"] == subprocess.PIPE

    # Verify that subprocess.Popen was called once
    assert subprocess.Popen.call_count == 1  # type: ignore


def test_install_dep_internal_failure_pyversion(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport", False)
    # Mock the subprocess.Popen context manager
    mock_popen = mocker.Mock()
    mock_popen.returncode = 0
    mocker.patch("subprocess.Popen", return_value=mock_popen)

    # Mock popen.stdout.read() to return the correct value
    mock_popen.stdout.read.return_value = b"Python 3.7"

    # Call the _installDepInternal method
    dep_to_install = "dep"
    deps_dir = "/path/to/dependencies"

    with pytest.raises(Exception):
        with patch.object(sys, "frozen", True, create=True):
            pluginManager._installDepInternal(dep_to_install, deps_dir)


def test_install_dep_internal_frozen_app(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport", False)

    # Mock the sys.frozen attribute to simulate a frozen app
    with patch.object(sys, "frozen", True, create=True):
        # Mock the subprocess.Popen context manager
        # to simulate a successful installation
        mock_popen = mocker.Mock()
        mock_popen.returncode = 0
        mock_popen.stdout.read.return_value = b"Python 3.9.16"
        mocker.patch("subprocess.Popen", return_value=mock_popen)

        # Mock the with ... as ... statement for popen
        mock_popen.__enter__ = mocker.Mock(return_value=mock_popen)
        mock_popen.__exit__ = mocker.Mock(return_value=None)

        # Call the _installDepInternal method
        dep_to_install = "dep"
        deps_dir = "/path/to/dependencies"

        with pytest.raises(Exception, match="'Mock' object is not iterable"):
            pluginManager._installDepInternal(dep_to_install, deps_dir)

    # Check the arguments of the last call to subprocess.Popen
    last_call_args, last_call_kwargs = subprocess.Popen.call_args  # type: ignore
    assert last_call_args[0] == [
        "python",
        "-m",
        "pip",
        "install",
        "dep",
        "--target",
        "/path/to/dependencies",
        "--upgrade",
        "--no-input",
    ]
    assert last_call_kwargs["stdout"] == subprocess.PIPE
    assert last_call_kwargs["stderr"] == subprocess.STDOUT
    assert last_call_kwargs["stdin"] == subprocess.PIPE

    # Verify that subprocess.Popen was called exactly twice
    assert subprocess.Popen.call_count == 2  # type: ignore
