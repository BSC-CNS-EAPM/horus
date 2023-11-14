import { useState, useEffect } from "react";
import { horusGet, horusPost } from "../Utils/utils";
import NBDButton from "../Components/nbdbutton";
import { PluginVariableView } from "../Components/FlowBuilder/block_variables";
import { PluginVariable } from "../Components/FlowBuilder/flow_builder_types";

// Import the css
import "../Components/FlowBuilder/block.css";

type Settings = PluginVariable & {
  category: string;
};

function parseSettings(settings: any): Settings[] {
  return settings.map((setting: any): Settings => {
    return {
      placedID: 0,
      id: setting.id,
      category: setting.setting.category,
      name: setting.setting.name,
      description: setting.setting.description,
      value: setting.setting.value,
      defaultValue: setting.setting.defaultValue,
      type: setting.setting.type,
      allowedValues: setting.setting.allowedValues,
    };
  });
}

function useSettings() {
  const [settings, setSettings] = useState<Settings[]>(null);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  async function getSettings() {
    const response = await horusGet("/api/settings");

    const data = await response.json();

    if (!data.ok) {
      alert("Error getting settings");
      return;
    }

    setSettings(parseSettings(data.settings));
  }

  async function restoreSettings() {
    if (!confirm("Are you sure you want to restore the default settings?")) {
      return;
    }

    const response = await horusGet("/api/restoreSettings");

    const data = await response.json();

    if (!data.ok) {
      alert("Error restoring settings");
      return;
    }

    getSettings();
  }

  async function saveSettings() {
    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify({
      settings: settings,
    });

    const response = await horusPost("/api/saveSettings", header, body);

    const data = await response.json();

    if (!data.ok) {
      alert("Error saving settings");
      return;
    }

    setHasChanges(false);
  }

  const onSettingChange = (value, settingID) => {
    const setting = settings.find((setting) => setting.id === settingID);
    if (setting.value !== value) {
      setting.value = value;
      setSettings([...settings]);
      setHasChanges(true);
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

  // Group settings by .category

  let groupedSettings = {};
  if (settings !== null) {
    groupedSettings = settings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = [];
      }
      acc[setting.category].push(setting);
      return acc;
    }, {} as Record<string, Settings[]>);
  }

  return {
    groupedSettings,
    hasChanges,
    saveSettings,
    onSettingChange,
    restoreSettings,
  };
}

function SettingsView() {
  const {
    groupedSettings,
    hasChanges,
    saveSettings,
    onSettingChange,
    restoreSettings,
  } = useSettings();

  const SettingsView = Object.keys(groupedSettings).map((category) => {
    return (
      <div className="flex flex-col gap-2 align-center text-center">
        <h2>{category}</h2>
        {groupedSettings[category].map((setting) => {
          return (
            <PluginVariableView
              key={setting.id}
              variable={setting}
              onChange={onSettingChange}
            />
          );
        })}
      </div>
    );
  });

  return (
    <div
      className="p-4 overflow-scroll"
      style={{
        height: "100%",
      }}
    >
      <div className="flex flex-row justify-between items-center">
        <h1>Settings</h1>
        <div className="flex flex-row gap-2">
          <NBDButton
            className={hasChanges ? "bg-orange-300" : ""}
            action={saveSettings}
          >
            Save
          </NBDButton>
          <NBDButton action={restoreSettings}>Restore defaults</NBDButton>
        </div>
      </div>
      {SettingsView.length > 0 ? SettingsView : <div>No settings found</div>}
      <h1>About Horus</h1>
      <div className="flex flex-row justify-between items-center">
        <iframe src="/about" style={{ width: "100%" }}></iframe>
      </div>
    </div>
  );
}

export { SettingsView };
