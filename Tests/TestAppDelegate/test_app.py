import pytest
import os
import json

from App import AppDelegate
from Server.SettingsManager import Setting
from Server.SettingsManager import SettingsManager as HorusSettings
from HorusAPI import VariableTypes


@pytest.fixture
def appDelegate_default():
    return AppDelegate()


def test_AppDelegate_startup(appDelegate_default: AppDelegate):
    # Check basic props
    assert appDelegate_default.debug is False
    assert appDelegate_default.serverMode is False
    assert appDelegate_default.browser is False

    # Check app info
    assert appDelegate_default.APP_INFO != {}
    assert appDelegate_default.APP_INFO["NAME"] == "Horus"
    assert appDelegate_default.APP_INFO["BUNDLE_IDENTIFIER"] == "com.nostrumbiodiscovery.horus"
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

    setting = Setting("id", "name", "value", "description", "category", VariableTypes.STRING)

    assert setting.id == "id"
    assert setting.name == "name"
    assert setting.value == "value"
    assert setting.description == "description"
    assert setting.category == "category"
    assert setting.type == VariableTypes.STRING


def test_setting_to_dict():
    """
    Test the toDict method of a Setting instance
    """

    setting = Setting("id", "name", "value", "description", "category", VariableTypes.STRING)
    setting_dict = setting.toDict()

    assert setting_dict == {
        "name": "name",
        "value": "value",
        "description": "description",
        "category": "category",
        "type": "string",
        "allowedValues": [],
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

    # Create a user settings file
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

    # Call the _loadSettings method
    horus_settings._loadSettings()

    # Check that the settings were loaded correctly
    assert horus_settings.settings["id"].name == "name"
    assert horus_settings.settings["id"].value == "value"
    assert horus_settings.settings["id"].description == "description"
    assert horus_settings.settings["id"].category == "category"


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
        print(f"USER: KEY {key}, VALUE {user_settings[key]}")
        print(f"DEFAULT: KEY {key}, VALUE {default_settings[key]}")
        assert user_settings[key] == default_settings[key]


def test_horus_settings_update_setting(horus_settings):
    """
    Test the updateSetting method of a HorusSettings instance
    """

    # Call the getSetting method
    setting = horus_settings.getSetting("dependenciesInterpreter")

    # Update the setting
    setting.name = "new_name"
    horus_settings._updateSetting(setting)

    # Check that the setting was updated correctly
    with open(horus_settings.userSettingsPath, "r") as f:
        user_settings = json.load(f)

    assert user_settings["dependenciesInterpreter"]["name"] == "new_name"
