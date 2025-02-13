"""
Settings manager for the Horus app
"""

import os
import typing
import json
import sys
import logging

from HorusAPI import VariableTypes, HorusSingleton


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

    _value: typing.Any = None
    """
    The value of the setting
    """

    defaultValue: typing.Any = None
    """
    The default value of the setting
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

    desktopOnly: bool = False
    """
    If the setting is only available on desktop (no webapp). If not,
    the setting will always return the default value
    """

    @property
    def value(self):
        """
        Returns the value of the setting
        """

        return self._value

    def __init__(
        self,
        id: str,
        name: str,
        value: typing.Any,
        defaultValue: typing.Any,
        description: str,
        category: str = "General",
        type: VariableTypes = VariableTypes.STRING,
        allowedValues: typing.Optional[typing.List[typing.Any]] = None,
        desktopOnly: bool = False,
    ):
        """
        Create a Setting instance

        :param id: The ID of the setting
        :param name: A short name of the setting
        :param value: The value of the setting
        :param description: The description of the setting
        :param category: The category of the setting
        :param type: The type of the setting as VariableTypes
        :param allowedValues: The allowed values of the setting
        :param desktopOnly: If the setting is only available on unsafe mode (Not public server).
        """
        self.id = id
        self.name = name
        self._value = value
        self.defaultValue = defaultValue
        self.description = description
        self.category = category
        self.type = type

        if allowedValues is None:
            allowedValues = []
        self.allowedValues = allowedValues

        self.desktopOnly = desktopOnly

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

    # Define a method to get a JSON serializable dict of the setting
    def toDict(self):
        """
        Serializes the setting to a dict
        """

        return {
            "name": self.name,
            "value": self.value,
            "defaultValue": self.defaultValue,
            "description": self.description,
            "category": self.category,
            "type": self.type.value,
            "allowedValues": self.allowedValues if len(self.allowedValues) > 0 else None,
            "desktopOnly": self.desktopOnly,
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
            bundleDir = sys._MEIPASS  # type: ignore
            self.defaultSettingsPath = os.path.abspath(
                os.path.join(bundleDir, "default_settings.json")
            )
        except AttributeError:
            self.defaultSettingsPath = os.path.abspath(
                os.path.join("App", "default_settings.json")
            )

        logging.getLogger("Horus").info(
            "Reading default settings from: %s", self.defaultSettingsPath
        )

        # Define the user settings path
        self.userSettingsPath = os.path.join(appSupportDir, "settings.json")

        logging.getLogger("Horus").info("Reading user settings from: %s", self.userSettingsPath)

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
        with open(self.defaultSettingsPath, "r", encoding="utf-8") as f:
            defaultSettings = json.load(f)

        # Write the default settings to the user settings file
        with open(self.userSettingsPath, "w", encoding="utf-8") as f:
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
        try:
            with open(self.userSettingsPath, "r", encoding="utf-8") as f:
                fileSettings = json.load(f)
        except json.JSONDecodeError:
            # If the settings file is corrupted, create a new one
            self._createSettings()

            # Re-read the settings
            with open(self.userSettingsPath, "r", encoding="utf-8") as f:
                fileSettings = json.load(f)

        # Load the default settings and add any missing settings
        with open(self.defaultSettingsPath, "r", encoding="utf-8") as f:
            defaultSettings = json.load(f)

        newChanges = False
        for key, value in defaultSettings.items():
            # If a new setting is found, add it to the settings file
            if key not in fileSettings:
                fileSettings[key] = value
                newChanges = True
                logging.getLogger("Horus").info("Added setting %s to the settings file", key)
                continue

            # If the description, name or category of a setting has changed, update it
            if any(
                fileSettings[key].get(k) != value.get(k)
                for k in {"description", "name", "category", "type", "allowedValues"}
                if k in fileSettings[key] and k in value
            ):

                # If the difference comes form the allowedValues between null and [], then pass, as for
                # compatibility purposes null is needed instead of []
                if fileSettings.get("allowedValues") == None and value.get("allowedValues") == []:
                    pass
                else:
                    fileSettings[key] = value
                    newChanges = True

                    print(json.dumps(fileSettings[key], indent=4))
                    print(json.dumps(value, indent=4))

                    logging.getLogger("Horus").info(
                        "Updated setting '%s'",
                        key,
                    )

        if newChanges:
            with open(self.userSettingsPath, "w", encoding="utf-8") as f:
                json.dump(fileSettings, f)

        # Instantiate the settings
        self.settings = {}
        for key, value in fileSettings.items():

            # If the setting does not exist in the default settings, skip it
            # so it will be removed from the settings file
            if key not in defaultSettings:
                continue

            try:
                newSetting = Setting(
                    key,
                    value["name"],
                    value["value"],
                    value.get("defaultValue", value["value"]),
                    value["description"],
                    value["category"],
                    VariableTypes(value["type"]),
                    value.get("allowedValues", []),
                    value.get("desktopOnly", False),
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
                    defaultSettings[key].get("defaultValue", value["value"]),
                    defaultSettings[key]["description"],
                    defaultSettings[key]["category"],
                    VariableTypes(defaultSettings[key]["type"]),
                    defaultSettings[key].get("allowedValues", []),
                    defaultSettings[key].get("desktopOnly", True),
                )

            # If the setting already exists, raise an exception
            if newSetting.id in self.settings:
                logging.getLogger("Horus").error(
                    "The setting %s is duplicated.\
                    Make sure that each setting has a unique ID.",
                    newSetting.id,
                )

                logging.getLogger("Horus").debug(
                    "TODO: Use a SQL database to store the settings to prevent race conditions and thread safety issues"
                )

                continue
                # raise Exception(
                #     f"The setting {newSetting.id} is duplicated.\
                #     Make sure that each setting has a unique ID."
                # )

            # Add the setting to the settings list
            self.settings[newSetting.id] = newSetting

            # Save the settings
            self._saveSettings()

    def getSetting(self, id: str) -> Setting:
        """
        Returns a setting by its ID

        :param id: The ID of the setting
        """

        # Reload the settings
        self._loadSettings()

        # Get the setting
        setting = self.settings.get(id, None)

        if setting is None:
            raise Exception(f"The setting '{id}' does not exist")

        return setting

    def restoreDefaults(self):
        """
        Restores the default settings
        """

        # Load the default settings
        with open(self.defaultSettingsPath, "r", encoding="utf-8") as f:
            defaultSettings = json.load(f)

        # Write the default settings to the user settings file
        with open(self.userSettingsPath, "w", encoding="utf-8") as f:
            json.dump(defaultSettings, f)

        # Reload the settings
        self._loadSettings()

    def _updateSetting(self, setting: Setting):
        """
        Updates a setting

        :param setting: The setting instance updated to save
        """

        self.settings[setting.id] = setting

        logging.getLogger("Horus").info(
            "Updated setting '%s' with value '%s'", setting.id, setting.value
        )

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

    def listSettings(self) -> typing.Dict[str, dict]:
        """
        Returns the list of settings as a JSON object
        """

        # Reload the settings
        self._loadSettings()

        from App import AppDelegate

        settingsDict: typing.Dict[str, dict] = {}
        for settingID, setting in self.settings.items():
            if setting.desktopOnly and AppDelegate().safeMode:
                continue
            settingsDict[settingID] = setting.toDict()

        return settingsDict

    def listUnsafeSettings(self) -> typing.Dict[str, dict]:
        """
        Returns the list of unsafe settings as a JSON object
        """

        # Reload the settings
        self._loadSettings()

        from App import AppDelegate

        settingsDict: typing.Dict[str, dict] = {}
        for settingID, setting in self.settings.items():
            if setting.desktopOnly and AppDelegate().safeMode:
                settingsDict[settingID] = setting.toDict()

        return settingsDict

    def saveSettings(
        self, newSettings: typing.List[typing.Dict[str, str]], allowUnsafe: bool = False
    ):
        """
        Parses the settings recived from the user and stores them

        :param newSettings: The new settings to save
        """

        from App import AppDelegate

        # Loop over the new settings
        allSettings = self.settings.copy()
        for newSetting in newSettings:
            # Get the setting
            setting = allSettings.get(newSetting["id"])

            if setting is None:
                continue

            # Update the setting only if it is not desktop only or if the app is not in safe mode
            if setting.desktopOnly and AppDelegate().safeMode and not allowUnsafe:
                logging.getLogger("Horus").error(
                    "Trying to update an unsfe setting '%s' in WebApp mode. Skipping...",
                    setting.id,
                )
                continue

            setting._value = newSetting["value"]

            self._updateSetting(setting)

        # Save the settings
        self._saveSettings()
