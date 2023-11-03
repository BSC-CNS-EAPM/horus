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
    const response = await horusGet("/settings");

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

    const response = await horusGet("/restoreSettings");

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

    const response = await horusPost("/saveSettings", header, body);

    const data = await response.json();

    if (!data.ok) {
      alert("Error saving settings");
      return;
    }

    setHasChanges(false);
  }

  const onSettingChange = (event) => {
    const setting = settings.find((setting) => setting.id === event.target.id);
    if (setting.value !== event.target.value) {
      setting.value = event.target.value;
      setSettings([...settings]);
      setHasChanges(true);
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

  return {
    settings,
    hasChanges,
    saveSettings,
    onSettingChange,
    restoreSettings,
  };
}

function SettingsView() {
  const {
    settings,
    hasChanges,
    saveSettings,
    onSettingChange,
    restoreSettings,
  } = useSettings();

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
      {settings &&
        settings.map((setting) => (
          <PluginVariableView
            variable={setting}
            onChange={(value) => {
              const event = {
                target: {
                  id: setting.id,
                  value: value,
                },
              };
              onSettingChange(event);
            }}
          />
          // <div key={setting.id} className="plugin-variable">
          //   <div className="plugin-variable-name">{setting.name}</div>
          //   <div className="plugin-variable-description">
          //     {setting.description}
          //   </div>
          //   <input
          //     className="plugin-variable-value ps-2 pe-2 text-center"
          //     type="text"
          //     value={setting.value}
          //     onChange={onSettingChange}
          //     id={setting.id}
          //   />
          // </div>
        ))}
      <h1>About Horus</h1>
      <div className="flex flex-row justify-between items-center">
        <iframe src="/about" style={{ width: "100%" }}></iframe>
      </div>
    </div>
  );
}

export { SettingsView };
