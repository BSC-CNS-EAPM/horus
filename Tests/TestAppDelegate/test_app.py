import pytest
import os
import json
import time
import requests
import sys
from multiprocess import Process  # type: ignore pylint: disable=no-name-in-module

from App import AppDelegate
from Server.SettingsManager import Setting
from Server.SettingsManager import SettingsManager as HorusSettings
from HorusAPI import VariableTypes
import pytest

from unittest.mock import patch


def test_launch_app_not_compiled():
    from Horus import launchApp

    def launchHorusProcess():
        # Clean the sys.argv
        sys.argv = sys.argv[:1]

        # Add arguments to simulate the command line
        sys.argv.append("--server")
        sys.argv.append("--host")
        sys.argv.append("localhost")
        sys.argv.append("--port")
        sys.argv.append("3124")

        launchApp()

    # Create a new thread and start it
    process = Process(target=launchHorusProcess)
    process.start()

    # Wait for the server to start
    time.sleep(5)

    baseURL = "http://localhost:3124"

    # Check that the server is running
    try:
        requests.get(baseURL, timeout=10)
    except requests.exceptions.ConnectionError:
        pytest.fail("Connection error")
    finally:
        # Kill the process
        process.kill()

        # Wait for the process to finish
        process.join()

        time.sleep(1)


def test_launch_app_compiled():
    # mock the cython.compiled variable to return true
    from Horus import launchApp

    def launchHorusProcess():
        # Clean the sys.argv
        sys.argv = sys.argv[:1]

        # Add arguments to simulate the command line
        sys.argv.append("--server")
        sys.argv.append("--host")
        sys.argv.append("localhost")
        sys.argv.append("--port")
        sys.argv.append("3124")

        patch("cython.compiled", True)
        patch("sys._MEIPASS", "path", create=True)
        patch("os.path.exists", return_value=True)

        launchApp()

    # Create a new thread and start it
    process = Process(target=launchHorusProcess)
    process.start()

    # Wait for the server to start
    time.sleep(1)

    baseURL = "http://localhost:3124"

    # Check that the server is running
    try:
        requests.get(baseURL, timeout=10)
    except requests.exceptions.ConnectionError:
        pytest.fail("Connection error")
    finally:
        # Kill the process
        process.kill()

        # Wait for the process to finish
        process.join()

        time.sleep(1)


@pytest.fixture
def appDelegate_default():
    return AppDelegate()


@pytest.mark.filterwarnings("ignore::DeprecationWarning")
def test_AppDelegate_startup(appDelegate_default: AppDelegate):
    # Check basic props
    assert appDelegate_default.debug is False
    assert appDelegate_default.desktop is True
    assert appDelegate_default.safeMode is False

    # Check app info
    assert appDelegate_default.APP_INFO != {}
    assert appDelegate_default.APP_INFO["NAME"] == "Horus"
    assert appDelegate_default.APP_INFO["BUNDLE_IDENTIFIER"] == "com.bsc.horus"
    assert appDelegate_default.APP_INFO["PYTHON_VERSION"] == "3.9.16"


@pytest.fixture
def horus_settings(tmpdir):
    """
    Fixture that creates a HorusSettings instance with a temporary directory
    """
    hsettings = HorusSettings(tmpdir)

    hsettings.defaultSettingsPath = os.path.join("App", "default_settings.json")
    return hsettings


def test_setting_init():
    """
    Test the initialization of a Setting instance
    """

    setting = Setting(
        "id", "name", "value", "defaultValue", "description", "category", VariableTypes.STRING
    )

    assert setting.id == "id"
    assert setting.name == "name"
    assert setting.value == "value"
    assert setting.defaultValue == "defaultValue"
    assert setting.description == "description"
    assert setting.category == "category"
    assert setting.type == VariableTypes.STRING


def test_setting_to_dict():
    """
    Test the toDict method of a Setting instance
    """

    setting = Setting(
        "id", "name", "value", "defaultValue", "description", "category", VariableTypes.STRING
    )
    setting_dict = setting.toDict()

    assert setting_dict == {
        "name": "name",
        "value": "value",
        "defaultValue": "defaultValue",
        "description": "description",
        "category": "category",
        "type": "string",
        "allowedValues": None,
        "desktopOnly": False,
    }


def test_horus_settings_init(horus_settings):
    """
    Test the initialization of a HorusSettings instance
    """

    with open(horus_settings.defaultSettingsPath, "r") as f:
        default_settings = json.load(f)

    assert horus_settings.settings.keys() == default_settings.keys()


def test_horus_settings_create_settings(horus_settings):
    """
    Test the _createSettings method of a HorusSettings instance
    """

    # Call the _createSettings method
    horus_settings._createSettings()

    # Check that the user settings file was created and contains the default settings
    with open(horus_settings.userSettingsPath, "r") as f:
        user_settings = json.load(f)

    with open(horus_settings.defaultSettingsPath, "r") as f:
        default_settings = json.load(f)

    assert user_settings == default_settings


def test_horus_settings_load_settings(horus_settings):
    """
    Test the _loadSettings method of a HorusSettings instance
    """

    # Create a fake user settings
    # this setting does not exists on the default settings
    # therefore it should be automatically deleted
    with open(horus_settings.userSettingsPath, "w") as f:
        json.dump(
            {
                "id": {
                    "name": "name",
                    "value": "value",
                    "description": "description",
                    "category": "category",
                    "type": "string",
                    "allowedValues": [],
                }
            },
            f,
        )

    # Call the _loadSettings method in order to reload the settings
    # and remove the invalid setting
    horus_settings._loadSettings()

    # Check that the settings were loaded correctly
    assert horus_settings.settings.get("id") is None

    # Check that the default settings are present, for example
    # the dependencies interpreter
    assert horus_settings.settings.get("dependenciesInterpreter") is not None


def test_horus_settings_get_setting(horus_settings):
    """
    Test the getSetting method of a HorusSettings instance
    """

    # Call the getSetting method
    setting = horus_settings.getSetting("dependenciesInterpreter")

    # Check that the setting was returned correctly
    assert setting.name == "Python interpreter"
    assert setting.value == "python"
    assert setting.description == "Python interpreter path to use for dependencies installation"
    assert setting.category == "Dependencies"


def test_horus_settings_restore_defaults(horus_settings):
    """
    Test the restoreDefaults method of a HorusSettings instance
    """

    # Create a user settings file
    with open(horus_settings.userSettingsPath, "w") as f:
        json.dump(
            {
                "rubbish": {
                    "name": "name",
                    "value": "value",
                    "description": "description",
                    "category": "category",
                    "type": "string",
                    "allowedValues": [],
                }
            },
            f,
        )

    # Call the restoreDefaults method
    horus_settings.restoreDefaults()

    # Check that the user settings file was updated with the default settings
    with open(horus_settings.defaultSettingsPath, "r") as f:
        default_settings = json.load(f)

    # Load the user settings file
    with open(horus_settings.userSettingsPath, "r") as f:
        user_settings = json.load(f)

    for key in default_settings.keys():
        assert user_settings[key]["value"] == default_settings[key]["value"]


def test_horus_settings_update_setting(horus_settings):
    """
    Test the updateSetting method of a HorusSettings instance
    """

    # Call the getSetting method
    setting = horus_settings.getSetting("dependenciesInterpreter")

    # Update the setting
    setting.name = "new_name"
    horus_settings._updateSetting(setting)
    horus_settings._saveSettings()

    # Check that the setting was updated correctly
    with open(horus_settings.userSettingsPath, "r") as f:
        user_settings = json.load(f)

    assert user_settings["dependenciesInterpreter"]["name"] == "new_name"
