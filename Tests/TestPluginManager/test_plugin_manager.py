from Server.PluginManager import PluginManager
from Server.RemotesManager import RemotesManager
from HorusAPI import Plugin
import os
import sys
import pytest
from unittest.mock import MagicMock
import shutil
import subprocess
from unittest.mock import patch


def test_checkPlugin():
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    # Create a mock plugin file
    entryPath = "Tests/TestServer/test_plugin.py"
    with open(entryPath, "w") as f:
        f.write("from HorusAPI import Plugin\nplugin = Plugin()")

    pluginDir = "Tests/TestServer"

    metaPath = "Tests/TestServer/plugin.meta"
    with open(metaPath, "w") as f:
        f.write(
            """
{
  "id": "test",
  "name": "TestPlugin",
  "description": "The test plugin for Horus",
  "author": "BSC",
  "version": "0.0.1",
  "pluginFile": "test_plugin.py",
  "dependencies": []
}"""
        )
    try:
        # Call the _checkPlugin function
        plugin = pluginManager._checkPlugin(os.path.abspath(pluginDir))
    except Exception as e:
        raise e
    finally:
        # Clean up the mock plugin file
        os.remove(entryPath)
        os.remove(metaPath)

    # Check that the plugin is valid
    assert plugin is not None
    assert isinstance(plugin, Plugin)
    assert plugin.pluginMeta.name == "TestPlugin"
    assert plugin.pluginMeta.version == "0.0.1"
    assert plugin.pluginMeta.author == "BSC"
    assert plugin.pluginMeta.description == "The test plugin for Horus"
    assert plugin.pluginMeta.dependencies == []

    # Check that the comparison operators work
    assert plugin == plugin


def test_plugins_deps_dir_creation(mocker):
    # Create an instance of PluginManager
    app_support_dir = "/path/to/app_support"
    pluginManager = PluginManager(app_support_dir)
    pluginManager.appSupportDir = app_support_dir

    # Mock os.path and sys._MEIPASS
    mocker.patch("os.path.join", side_effect=lambda *args: "/".join(args))
    mocker.patch("os.path.exists", side_effect=lambda x: False)  # Mock directory not existing
    mocker.patch("os.makedirs")  # Mock the os.mkdir function

    # Call the _pluginsDepsDir method
    pluginManager._pluginsDepsDir()

    # Assert that the directories are created correctly and paths are set
    assert pluginManager.defaultPluginsDir == "/path/to/app_support/DefaultPlugins"
    assert pluginManager.pluginsDir == "/path/to/app_support/Plugins"

    os.makedirs.assert_has_calls(
        [
            mocker.call("/path/to/app_support/Plugins", exist_ok=True),
        ]
    )

    del pluginManager


def test_install_plugin_success(mocker):
    # Create an instance of PluginManager
    pluginManager = PluginManager()
    pluginManager.appSupportDir = "AppSupport"

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
    # Mock the os.listdir function to return a list of files
    mocker.patch("os.listdir", return_value=["file1", "file2"])
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

    # Remove the /path/to/plugins directory from the singleton
    pluginManager.appSupportDir = "AppSupport"
    pluginManager._pluginsDepsDir()


def test_install_plugin_load_failure(mocker):
    # Create an instance of PluginManager
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

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
  "id": "test",
  "name": "TestPlugin",
  "description": "The Test plugin for Horus",
  "author": "BSC",
  "version": "0.0.1",
  "pluginFile": "test_plugin.py",
  "dependencies": []
}"""
        )

    try:
        pluginManager._checkPlugin(os.path.abspath(pluginDir))

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

    del pluginManager


def test_install_dep_internal_success(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"
    # Init the settings manager
    from Server.SettingsManager import SettingsManager

    settingsManager = SettingsManager("AppSupport")

    from App import AppDelegate

    # Set the app delegate to be on "Server mode"
    AppDelegate().mode = "server"
    AppDelegate().desktop = False

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
    deps_dir = "/path/to/"

    with pytest.raises(
        Exception,
        match="Failed to install dependency dep. External interpreter error: 'Mock' object is not iterable",
    ):
        pluginManager._installDepInternal(dep_to_install, deps_dir)

    # Check the arguments of the last call to subprocess.Popen
    last_call_args, last_call_kwargs = subprocess.Popen.call_args  # type: ignore
    assert last_call_args[0] == [
        "python",
        "-m",
        "pip",
        "install",
        "dep",
        "--prefix",
        "/path/to/deps",
        "--upgrade",
        "--no-input",
        "--ignore-installed",
    ]
    assert last_call_kwargs["stdout"] == subprocess.PIPE
    assert last_call_kwargs["stderr"] == subprocess.STDOUT
    assert last_call_kwargs["stdin"] == subprocess.DEVNULL

    # Verify that subprocess.Popen was called once
    assert subprocess.Popen.call_count == 3  # type: ignore

    del pluginManager


def test_install_dep_internal_failure_pyversion(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"
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

    del pluginManager


def test_install_dep_internal_frozen_app(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    # Init the settings manager
    from Server.SettingsManager import SettingsManager

    settingsManager = SettingsManager("AppSupport")

    from App import AppDelegate

    # Set the app delegate to be on "Server mode"
    AppDelegate().mode = "server"
    AppDelegate().desktop = False

    # Mock the sys.frozen attribute to simulate a frozen app
    with patch.object(sys, "frozen", True, create=True):
        # Mock the subprocess.Popen context manager
        # to simulate a successful installation
        mock_popen = mocker.Mock()
        mock_popen.returncode = 0
        mocker.patch("subprocess.Popen", return_value=mock_popen)

        # Mock the with ... as ... statement for popen
        mock_popen.__enter__ = mocker.Mock(return_value=mock_popen)
        mock_popen.__exit__ = mocker.Mock(return_value=None)

        # Call the _installDepInternal method
        dep_to_install = "dep"
        deps_dir = "/path/to/"

        with pytest.raises(Exception, match="'Mock' object is not subscriptable"):
            pluginManager._installDepInternal(dep_to_install, deps_dir)

    # With embedded pip the call now is on the meipass (uncompiled is the cwd) + pip/pip
    pipPath = os.path.join(os.getcwd(), "pip", "pip")

    # Check the arguments of the internal pip call to subprocess.Popen
    second_last_call_args, second_last_call_kwargs = subprocess.Popen.call_args_list[-2]  # type: ignore
    assert second_last_call_args[0] == [
        pipPath,
        "install",
        "dep",
        "--prefix",
        "/path/to/deps",
        "--upgrade",
        "--no-input",
        "--ignore-installed",
    ]
    assert second_last_call_kwargs["stdout"] == subprocess.PIPE
    assert second_last_call_kwargs["stderr"] == subprocess.STDOUT
    assert second_last_call_kwargs["stdin"] == subprocess.DEVNULL

    # Verify that subprocess.Popen was called exactly twice (one for each method internal pip & external python)
    assert subprocess.Popen.call_count == 2  # type: ignore

    del pluginManager


# Create a mock plugin file
pluginDir = os.path.abspath("Tests/TestPluginManager/Plugins/")


def test_no_dependencies_install(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    from App import AppDelegate

    # Set the app delegate to be on "Server mode"
    AppDelegate().mode = "server"
    AppDelegate().desktop = False

    # Mock the subprocess.Popen context manager
    mock_popen = mocker.Mock()
    mock_popen.returncode = 0
    mocker.patch("subprocess.Popen", return_value=mock_popen)
    mock_popen.__enter__ = mocker.Mock(return_value=mock_popen)
    mock_popen.__exit__ = mocker.Mock(return_value=None)

    # Call the _installDepInternal method
    dep_to_install = "numpy==1.26.4 --no-deps"
    deps_dir = "/path/to/dependencies"

    with pytest.raises(Exception):
        pluginManager._installDepInternal(dep_to_install, deps_dir)

        last_call_args, last_call_kwargs = subprocess.Popen.call_args  # type: ignore
        assert last_call_args[0] == [
            "python",
            "-m",
            "pip",
            "install",
            "numpy==1.26.4",
            "--target",
            "/path/to/dependencies",
            "--upgrade",
            "--no-input",
            "--no-deps",
        ]
    del pluginManager


def test_preinstall(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    from App import AppDelegate

    # Set the app delegate to be on "Server mode"
    AppDelegate().mode = "server"
    AppDelegate().desktop = False

    # Mock the subprocess.Popen context manager
    mock_popen = mocker.Mock()
    mock_popen.returncode = 0
    mocker.patch("subprocess.Popen", return_value=mock_popen)
    mock_popen.__enter__ = mocker.Mock(return_value=mock_popen)
    mock_popen.__exit__ = mocker.Mock(return_value=None)

    pluginDir = "Tests/TestPluginManager"
    pluginPath = "Tests/TestPluginManager/preinst.sh"

    with open(pluginPath, "w") as f:
        f.write("echo 'preinstallation script was run'")

    with pytest.raises(Exception):
        pluginManager._preInstallPlugin(pluginDir)
    last_call_args, last_call_kwargs = subprocess.Popen.call_args  # type: ignore
    assert last_call_args[0] == [
        "sh",
        "Tests/TestPluginManager/preinst.sh",
    ]
    os.remove(pluginPath)
    pluginManager._preInstallPlugin(pluginDir)

    assert subprocess.Popen.call_count == 1  # type: ignore

    del pluginManager


def test_postinstall(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    from App import AppDelegate

    # Set the app delegate to be on "Server mode"
    AppDelegate().mode = "server"
    AppDelegate().desktop = False

    # Mock the subprocess.Popen context manager
    mock_popen = mocker.Mock()
    mock_popen.returncode = 0
    mocker.patch("subprocess.Popen", return_value=mock_popen)
    mock_popen.__enter__ = mocker.Mock(return_value=mock_popen)
    mock_popen.__exit__ = mocker.Mock(return_value=None)

    pluginDir = "Tests/TestPluginManager"
    pluginPath = "Tests/TestPluginManager/postinst.sh"

    with open(pluginPath, "w") as f:
        f.write("echo 'postinstalation script was run'")
    with pytest.raises(Exception):
        pluginManager._postInstallPlugin(pluginDir)
    last_call_args, last_call_kwargs = subprocess.Popen.call_args  # type: ignore
    assert last_call_args[0] == [
        "sh",
        "Tests/TestPluginManager/postinst.sh",
    ]
    os.remove(pluginPath)
    pluginManager._postInstallPlugin(pluginDir)

    assert subprocess.Popen.call_count == 1  # type: ignore

    del pluginManager


def test_preremove(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    from App import AppDelegate

    # Set the app delegate to be on "Server mode"
    AppDelegate().mode = "server"
    AppDelegate().desktop = False

    # Mock the subprocess.Popen context manager
    mock_popen = mocker.Mock()
    mock_popen.returncode = 0
    mocker.patch("subprocess.Popen", return_value=mock_popen)
    mock_popen.__enter__ = mocker.Mock(return_value=mock_popen)
    mock_popen.__exit__ = mocker.Mock(return_value=None)

    pluginDir = "Tests/TestPluginManager"
    pluginPath = "Tests/TestPluginManager/prerm.sh"

    with open(pluginPath, "w") as f:
        f.write("echo 'pre remove script was run'")

    with pytest.raises(Exception):
        pluginManager._preRemovePlugin(pluginDir)
    last_call_args, last_call_kwargs = subprocess.Popen.call_args  # type: ignore
    assert last_call_args[0] == [
        "sh",
        "Tests/TestPluginManager/prerm.sh",
    ]
    os.remove(pluginPath)
    pluginManager._preRemovePlugin(pluginDir)

    assert subprocess.Popen.call_count == 1  # type: ignore

    del pluginManager


def test_posremove(mocker):
    # Create an instance of MyClass
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    from App import AppDelegate

    # Set the app delegate to be on "Server mode"
    AppDelegate().mode = "server"
    AppDelegate().desktop = False

    # Mock the subprocess.Popen context manager
    mock_popen = mocker.Mock()
    mock_popen.returncode = 0
    mocker.patch("subprocess.Popen", return_value=mock_popen)
    mock_popen.__enter__ = mocker.Mock(return_value=mock_popen)
    mock_popen.__exit__ = mocker.Mock(return_value=None)

    pluginDir = "Tests/TestPluginManager"
    pluginPath = "Tests/TestPluginManager/postrm.sh"

    with open(pluginPath, "w") as f:
        f.write("echo 'postrm script was run'")
    with pytest.raises(Exception):
        pluginManager._postRemovePlugin(pluginDir)
    last_call_args, last_call_kwargs = subprocess.Popen.call_args  # type: ignore
    assert last_call_args[0] == [
        "sh",
        "Tests/TestPluginManager/postrm.sh",
    ]
    os.remove(pluginPath)
    pluginManager._postRemovePlugin(pluginDir)

    assert subprocess.Popen.call_count == 1  # type: ignore

    del pluginManager


# Test the PluginConfigs
def test_test_plugin_load():
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"
    plugin = pluginManager._checkPlugin(pluginDir)

    # Check that the plugin is valid
    assert plugin is not None
    assert isinstance(plugin, Plugin)
    assert plugin.pluginMeta.name == "Plugin TEST"
    assert plugin.pluginMeta.version == "0.0.1"
    assert plugin.pluginMeta.author == "Test"
    assert plugin.pluginMeta.description == "This is a test plugin"
    assert plugin.pluginMeta.dependencies == []

    # Check that the comparison operators work
    assert plugin == plugin

    # Check the blocks of the plugin
    assert len(plugin.blocks) == 1

    # Check the variables of the block
    for block in plugin.blocks:
        assert len(block.variables) == 1
        assert block._variables[0].id == "myVariable"
        assert block._variables[0].name == "My Variable"
        assert block._variables[0].description == "My variable description."
        assert block._variables[0].type.value == "string"
        assert block._variables[0].defaultValue == "DEFAULTVALUE"

        assert block.variables["myVariable"] == "DEFAULTVALUE"


def test_test_plugin_config_init():
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    plugin = pluginManager._checkPlugin(pluginDir)

    # Check the configs of the plugin
    assert len(plugin.config) == 1
    assert "myVariable" in plugin.config

    # Check the variables of the config
    assert plugin.config["myVariable"] == "DEFAULTVALUE"


def test_test_plugin_config_assign_to_block():
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"
    plugin = pluginManager._checkPlugin(pluginDir)

    # Assign the config to the block
    block = plugin.blocks[0]

    block.config = plugin.config

    assert block.config["myVariable"] == "DEFAULTVALUE"


def test_test_plugin_config_update():
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    plugin = pluginManager._checkPlugin(pluginDir)

    remotes = RemotesManager("AppSupport").listRemotes(includeLocal=True)

    for remote in remotes:
        configPath = pluginManager._pluginConfigPath(plugin, remote["name"])
        plugin._updateConfigs(configPath)


def test_test_plugin_saveconfig():
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    # Load the test plugin
    pluginManager._loadPlugin(pluginDir)

    configBlock = pluginManager._getPluginByID("test_plugin")._getConfig(
        "test_plugin.config.configblock"
    )

    configBlock._updateVariables({"myVariable": "newConfig"})

    newConfig = [configBlock._toDict()]

    remotes = RemotesManager("AppSupport").listRemotes(includeLocal=True)

    for remote in remotes:
        pluginManager.saveConfig(newConfig, remote["name"])

    # Reload the plugin
    pluginManager.reloadPlugins()
    pluginManager._loadPlugin(pluginDir)

    plugin = pluginManager._getPluginByID("test_plugin")

    # Assign the new configs
    configPath = pluginManager._pluginConfigPath(plugin, remotes[0]["name"])
    plugin._updateConfigs(configPath)

    configBlock = pluginManager._getPluginByID("test_plugin")._getConfig(
        "test_plugin.config.configblock"
    )

    assert configBlock.variables["myVariable"] == "newConfig"

    # Reset the config
    configBlock._updateVariables({"myVariable": "DEFAULTVALUE"})

    newConfig = [configBlock._toDict()]

    for remote in remotes:
        pluginManager.saveConfig(newConfig, remote["name"])

    # Reload the plugin
    pluginManager.reloadPlugins()
    pluginManager._loadPlugin(pluginDir)

    plugin = pluginManager._getPluginByID("test_plugin")

    # Assign the new configs
    configPath = pluginManager._pluginConfigPath(plugin, remotes[0]["name"])
    plugin._updateConfigs(configPath)

    configBlock = pluginManager._getPluginByID("test_plugin")._getConfig(
        "test_plugin.config.configblock"
    )

    assert configBlock.variables["myVariable"] == "DEFAULTVALUE"


import shutil
import os
import json


def test_plugin_upgrade():
    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    # Backup the plugin.meta
    shutil.copyfile(
        os.path.join(pluginDir, "plugin.meta"),
        os.path.join(pluginDir, "plugin.meta.bak"),
    )

    plugin_test_path = None

    try:
        pluginManager.reloadPlugins()
        # First load the unmodified plugin
        pluginManager._loadPlugin(pluginDir)

        # Modify the plugin.meta to upgrade the version
        # Read as JSON
        with open(os.path.join(pluginDir, "plugin.meta"), "r") as f:
            pluginMeta = json.load(f)

        # Modify the version
        pluginMeta["version"] = "0.0.2"

        # Write back to file
        with open(os.path.join(pluginDir, "plugin.meta"), "w") as f:
            json.dump(pluginMeta, f)

        plugin_test_path = "Tests/TestPluginManager/Plugins/test_plugin.hp"

        # Zip the new plugin into .hp format
        shutil.make_archive(
            plugin_test_path,
            "zip",
            pluginDir,
        )

        # Remove from the file the .zip extension
        os.rename(plugin_test_path + ".zip", plugin_test_path)

        # Try to upgrade the plugin
        pluginManager._installPlugin(plugin_test_path)

        # Check that the plugin was upgraded
        plugin = pluginManager._getPluginByID("test_plugin")

        assert plugin.pluginMeta.version == "0.0.2"
    finally:
        # Reset the plugin.meta file
        shutil.copyfile(
            os.path.join(pluginDir, "plugin.meta.bak"),
            os.path.join(pluginDir, "plugin.meta"),
        )
        os.remove(os.path.join(pluginDir, "plugin.meta.bak"))

        # Remove the .hp file
        if plugin_test_path is not None and os.path.exists(plugin_test_path):
            os.remove(plugin_test_path)

        # Remove the installed plugin in the AppSupport directory
        installedPath = os.path.join(pluginManager.pluginsDir, "test_plugin")
        if os.path.exists(installedPath):
            shutil.rmtree(installedPath)


def test_plugin_downgrade():
    if PluginManager._instances != {}:
        for pluginManager in PluginManager._instances.values():
            del pluginManager
        PluginManager._instances = {}

    pluginManager = PluginManager("AppSupport")
    pluginManager.appSupportDir = "AppSupport"

    # Unload any plugins from the singleton

    # Backup the plugin.meta
    shutil.copyfile(
        os.path.join(pluginDir, "plugin.meta"),
        os.path.join(pluginDir, "plugin.meta.bak"),
    )

    plugin_test_path = None

    try:
        # First load the unmodified plugin
        pluginManager._loadPlugin(pluginDir)

        # Modify the plugin.meta to upgrade the version
        # Read as JSON
        with open(os.path.join(pluginDir, "plugin.meta"), "r") as f:
            pluginMeta = json.load(f)

        # Modify the version
        pluginMeta["version"] = "0.0.0"

        # Write back to file
        with open(os.path.join(pluginDir, "plugin.meta"), "w") as f:
            json.dump(pluginMeta, f)

        plugin_test_path = "Tests/TestPluginManager/Plugins/test_plugin.hp"

        # Zip the new plugin into .hp format
        shutil.make_archive(
            plugin_test_path,
            "zip",
            pluginDir,
        )

        # Remove from the file the .zip extension
        os.rename(plugin_test_path + ".zip", plugin_test_path)

        # Try to downgrade the plugin
        pluginManager._installPlugin(plugin_test_path)

        # Check that the plugin was downgraded
        plugin = pluginManager._getPluginByID("test_plugin")

        assert plugin.pluginMeta.version != "0.0.1"
    finally:
        # Reset the plugin.meta file
        shutil.copyfile(
            os.path.join(pluginDir, "plugin.meta.bak"),
            os.path.join(pluginDir, "plugin.meta"),
        )
        os.remove(os.path.join(pluginDir, "plugin.meta.bak"))

        # Remove the .hp file
        if plugin_test_path is not None and os.path.exists(plugin_test_path):
            os.remove(plugin_test_path)

        # Remove the installed plugin in the AppSupport directory
        installedPath = os.path.join(pluginManager.pluginsDir, "test_plugin")
        if os.path.exists(installedPath):
            shutil.rmtree(installedPath)
