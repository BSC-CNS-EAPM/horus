"""
Settings manager for the Horus app
"""

import os
import typing
import json
import sys

from HorusAPI import VariableTypes


class Setting:
    """
    A setting of the App
    """

    id: str = "unnamed_setting"
    """
    The ID of the setting
    """

    name: str = "Unnamed setting"
    """
    A short name of the setting
    """

    value: typing.Any = None
    """
    The value of the setting
    """

    description: str = "No description"
    """
    The description of the setting
    """

    category: str = "General"
    """
    The category of the setting
    """

    type: VariableTypes = VariableTypes.STRING
    """
    The type of the setting as VariableTypes
    """

    allowedValues: typing.List[typing.Any] = []
    """
    The allowed values of the setting
    """

    def __init__(
        self,
        id: str,
        name: str,
        value: typing.Any,
        description: str,
        category: str = "General",
        type: VariableTypes = VariableTypes.STRING,
        allowedValues: typing.List[typing.Any] = [],
    ):
        """
        Create a Setting instance

        :param id: The ID of the setting
        :param name: A short name of the setting
        :param value: The value of the setting
        :param description: The description of the setting
        :param category: The category of the setting
        :param type: The type of the setting as VariableTypes
        """
        self.id = id
        self.name = name
        self.value = value
        self.description = description
        self.category = category
        self.type = type
        self.allowedValues = allowedValues

    # Define comparison operators
    def __eq__(self, other):
        return self.id == other.id

    def __ne__(self, other):
        return self.id != other.id

    def __str__(self):
        return self.id

    def __repr__(self):
        return self.id

    def __hash__(self):
        return hash(self.id)

    def __dict__(self):
        return self.toDict()

    # Define a method to get a JSON serializable dict of the setting
    def toDict(self):
        """
        Serializes the setting to a dict
        """

        return {
            "name": self.name,
            "value": self.value,
            "description": self.description,
            "category": self.category,
            "type": self.type.value,
            "allowedValues": self.allowedValues,
        }


class SettingsManager:
    """
    Manage the Horus app settings
    """

    settings: typing.Dict[str, Setting] = {}
    """
    The settings of the app

    :type: dict[str, Setting]
    - key: The ID of the setting
    - value: The setting instance
    """

    def __init__(self, appSupportDir: str) -> None:
        """
        Manage and load the settings of the app

        :param appSupportDir: The path to the app support directory
        """

        # Define the default settings path based on if the app is frozen
        try:
            bundle_dir = sys._MEIPASS  # type: ignore
            self.defaultSettingsPath = os.path.abspath(
                os.path.join(bundle_dir, "default_settings.json")
            )
        except AttributeError:
            self.defaultSettingsPath = os.path.join("App", "default_settings.json")

        # Define the user settings path
        self.userSettingsPath = os.path.join(appSupportDir, "settings.json")

        # Load the settings
        self._loadSettings()

    def _createSettings(self):
        """
        If no settings file exists, create one with the default settings
        """

        # Check if the default settings file exists
        if not os.path.exists(self.defaultSettingsPath):
            raise Exception("The default settings file does not exist")

        # Load the default settings
        with open(self.defaultSettingsPath, "r") as f:
            defaultSettings = json.load(f)

        # Write the default settings to the user settings file
        with open(self.userSettingsPath, "w") as f:
            json.dump(defaultSettings, f)

    def _loadSettings(self):
        """
        Loads the settings from the settings file
        """

        # Check if the settings file exists
        if not os.path.exists(self.userSettingsPath):
            # Create the settings file
            self._createSettings()

        # Load the settings
        with open(self.userSettingsPath, "r") as f:
            fileSettings = json.load(f)

        # Load the default settings and add any missing settings
        with open(self.defaultSettingsPath, "r") as f:
            defaultSettings = json.load(f)

        newChanges = False
        for key, value in defaultSettings.items():
            if key not in fileSettings:
                fileSettings[key] = value
                newChanges = True

        if newChanges:
            with open(self.userSettingsPath, "w") as f:
                json.dump(fileSettings, f)

        # Instantiate the settings
        self.settings = {}
        for key, value in fileSettings.items():
            try:
                newSetting = Setting(
                    key,
                    value["name"],
                    value["value"],
                    value["description"],
                    value["category"],
                    VariableTypes(value["type"]),
                    value.get("allowedValues", []),
                )
            except KeyError as keye:
                print(
                    f"The setting file is corrupted for setting {key}: {keye}. "
                    + "Restoring default..."
                )

                # Load the default settings for the corrupted setting
                newSetting = Setting(
                    key,
                    defaultSettings[key]["name"],
                    defaultSettings[key]["value"],
                    defaultSettings[key]["description"],
                    defaultSettings[key]["category"],
                    VariableTypes(defaultSettings[key]["type"]),
                    defaultSettings[key].get("allowedValues", []),
                )

            # If the setting already exists, raise an exception
            if newSetting.id in self.settings:
                raise Exception(
                    f"The setting {newSetting.id} is duplicated.\
                    Make sure that each setting has a unique ID."
                )

            # Add the setting to the settings list
            self.settings[newSetting.id] = newSetting

            # Save the settings
            self._saveSettings()

    def getSetting(self, id: str) -> Setting:
        """
        Returns a setting by its ID

        :param id: The ID of the setting
        """

        # Get the setting
        setting = self.settings.get(id, None)

        if setting is None:
            raise Exception("The setting does not exist")

        return setting

    def restoreDefaults(self):
        """
        Restores the default settings
        """

        # Load the default settings
        with open(self.defaultSettingsPath, "r") as f:
            defaultSettings = json.load(f)

        # Write the default settings to the user settings file
        with open(self.userSettingsPath, "w") as f:
            json.dump(defaultSettings, f)

        # Reload the settings
        self._loadSettings()

    def _updateSetting(self, setting: Setting):
        """
        Updates a setting

        :param setting: The setting instance updated to save
        """

        self.settings[setting.id] = setting

        # Save the settings
        self._saveSettings()

    def _saveSettings(self):
        """
        Updates the user settings file
        """

        settingsToSave = {}

        for id, setting in self.settings.items():
            settingsToSave[id] = setting.toDict()

        # Save the settings
        with open(self.userSettingsPath, "w", encoding="utf-8") as file:
            json.dump(settingsToSave, file)

    def listSettings(self):
        """
        Returns the list of settings as a JSON object
        """

        with open(self.userSettingsPath, "r", encoding="utf-8") as file:
            settings = json.load(file)

        settingsList = []
        for settingID, setting in settings.items():
            parsedSetting = {
                "id": settingID,
                "setting": setting,
            }
            settingsList.append(parsedSetting)

        return settingsList

    def saveSettings(self, newSettings: typing.List[typing.Dict[str, str]]):
        """
        Parses the settings recived from the user and stores them

        :param newSettings: The new settings to save
        """

        # Loop over the new settings
        for newSetting in newSettings:
            # Get the setting
            setting = self.getSetting(newSetting["id"])

            # Update the setting
            setting.value = newSetting["value"]

            # Update the setting
            self._updateSetting(setting)
