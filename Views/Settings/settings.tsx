import { useState, useEffect } from "react";
import { horusGet, horusPost } from "../Utils/utils";
import NBDButton from "../Components/nbdbutton";

// Import the css
import "../Components/FlowBuilder/block.css";

type Settings = {
  id: string;
  category: string;
  name: string;
  description: string;
  value: any;
};

function parseSettings(settings: any): Settings[] {
  return settings.map((setting: any) => {
    return {
      id: setting.id,
      category: setting.setting.category,
      name: setting.setting.name,
      description: setting.setting.description,
      value: setting.setting.value,
    };
  });
}

function useSettings() {
  const [settings, setSettings] = useState<Settings[]>(null);

  async function getSettings() {
    const response = await horusGet("/settings");

    const data = await response.json();

    if (!data.ok) {
      alert("Error getting settings");
      return;
    }

    setSettings(parseSettings(data.settings));
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
  }

  const onSettingChange = (event) => {
    const setting = settings.find((setting) => setting.id === event.target.id);

    setting.value = event.target.value;

    setSettings([...settings]);
  };

  useEffect(() => {
    getSettings();
  }, []);

  return { settings, saveSettings, onSettingChange };
}

function SettingsView() {
  const { settings, saveSettings, onSettingChange } = useSettings();

  return (
    <div
      className="p-4 overflow-scroll"
      style={{
        height: "100%",
      }}
    >
      <div className="flex flex-row justify-between items-center">
        <h1>Settings</h1>
        <NBDButton action={saveSettings}>Save</NBDButton>
      </div>
      {settings &&
        settings.map((setting) => (
          <div key={setting.id} className="plugin-variable">
            <div className="plugin-variable-name">{setting.name}</div>
            <div className="plugin-variable-description">
              {setting.description}
            </div>
            <input
              className="plugin-variable-value ps-2 pe-2 text-center"
              type="text"
              value={setting.value}
              onChange={onSettingChange}
              id={setting.id}
            />
          </div>
        ))}
      <h1>About Horus</h1>
      <div className="flex flex-row justify-between items-center">
        <iframe src="/about" style={{ width: "100%" }}></iframe>
      </div>
    </div>
  );
}

export { SettingsView };
