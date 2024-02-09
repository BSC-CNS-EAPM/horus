// React imports
import { useState, useEffect, useMemo } from "react";

// Horus web-server
import { horusGet, horusPost } from "../Utils/utils";

// Components
import NBDButton from "../Components/nbdbutton";
import About from "../About/about";
import SidebarView from "../Components/SidebarView/sidebar_view";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import { PluginVariableView } from "../Components/FlowBuilder/Variables/variables";

// TS types
import {
  PluginVariable,
  PluginVariableTypes,
} from "../Components/FlowBuilder/flow.types";
import { HorusSettingsObject } from "./setting";

// Import the css
import "../Components/FlowBuilder/Blocks/block.css";

export async function fetchSettings(): Promise<HorusSettingsObject | null> {
  const response = await horusGet("/api/settings");

  const data = await response.json();

  if (!data.ok) {
    alert("Error getting settings");
    return null;
  }

  // Store the settings
  window.horusSettings = data.settings as HorusSettingsObject;

  // Apply some instant settings
  // Parse the dark mode
  if (window.horusSettings["darkMode"]?.value) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.setAttribute("data-theme", "light");
  }

  return data.settings as HorusSettingsObject;
}

function parseSettingsIntoPluginVariable(
  settings: HorusSettingsObject | null
): PluginVariable[] {
  if (settings === null) {
    return [];
  }

  return Object.keys(settings).map((settingID: string): PluginVariable => {
    return {
      placedID: 0,
      id: settingID,
      category: settings[settingID]?.category ?? "Unknown",
      name: settings[settingID]?.name ?? "Unknown",
      description: settings[settingID]?.description ?? "Unknown",
      value: settings[settingID]?.value ?? "Unknown",
      defaultValue: settings[settingID]?.defaultValue ?? "Unknown",
      type: settings[settingID]?.type ?? PluginVariableTypes.ANY,
      allowedValues: settings[settingID]?.allowedValues ?? ["Unknown"],
    };
  });
}
function useSettings() {
  const [settings, setSettings] = useState<PluginVariable[] | null>(null);
  const [groupedSettings, setGroupedSettings] = useState<
    Record<string, PluginVariable[]>
  >({});
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  async function getSettings() {
    const settings = await fetchSettings();
    const parsedSettings = parseSettingsIntoPluginVariable(settings);

    // Group settings by .category
    let groupedSettings: Record<string, PluginVariable[]> = {};
    if (parsedSettings !== null) {
      groupedSettings = parsedSettings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = [];
        }
        acc[setting.category]!.push(setting);
        return acc;
      }, {} as Record<string, PluginVariable[]>);
    }

    // Set the settings and the gruped variables
    setSettings(parsedSettings);
    setGroupedSettings(groupedSettings);
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

  const [isSaving, setIsSaving] = useState<boolean>(false);

  async function saveSettings() {
    setIsSaving(true);

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
    } else {
      // Update the settings
      await getSettings();

      await new Promise((resolve) => setTimeout(resolve, 1000));

      setHasChanges(false);
    }

    setIsSaving(false);
  }

  const onSettingChange = (value: any, settingID: string) => {
    if (settings === null) {
      return;
    }

    const setting = settings.find((setting) => setting.id === settingID)!;
    if (setting.value !== value) {
      setting.value = value;
      setSettings([...settings]);
      setHasChanges(true);
    }
  };

  useEffect(() => {
    getSettings();
  }, []);

  return {
    groupedSettings,
    hasChanges,
    isSaving,
    saveSettings,
    onSettingChange,
    restoreSettings,
  };
}

function SettingsView() {
  const {
    groupedSettings,
    hasChanges,
    isSaving,
    saveSettings,
    onSettingChange,
    restoreSettings,
  } = useSettings();

  const getGroupedSettings = () => {
    const groupedViews: Record<string, React.ReactNode[]> = {};

    for (const [category, settings] of Object.entries(groupedSettings)) {
      const variableViews = settings.map((setting) => {
        return (
          <PluginVariableView
            key={setting.id}
            variable={setting}
            onChange={onSettingChange}
          />
        );
      });
      groupedViews[category] = [
        <div className="flex flex-col gap-2 flex-wrap">{variableViews}</div>,
      ];
    }

    // Add the "About" page as a view
    groupedViews["About Horus"] = [<About />];

    return groupedViews;
  };

  const memoizedGroupedSettings = useMemo(
    () => getGroupedSettings(),
    [groupedSettings]
  );

  return (
    <div className="root-plugin-container overflow-hidden w-full">
      <div className="flex flex-col">
        <SettingsHeader
          isSaving={isSaving}
          hasChanges={hasChanges}
          saveSettings={saveSettings}
          restoreSettings={restoreSettings}
        />
        {Object.keys(groupedSettings).length > 0 ? (
          <SidebarView views={memoizedGroupedSettings} />
        ) : (
          <div className="m-auto mb-2 mt-2 p-4 horus-container flex font-semibold justify-center items-center w-48 h-full">
            No settings found
          </div>
        )}
      </div>
    </div>
  );
}

function SettingsHeader(props: {
  hasChanges: boolean;
  isSaving: boolean;
  saveSettings: () => void;
  restoreSettings: () => void;
}) {
  return (
    <div className="plugin-manager-title flex">
      <div
        className="
    text-2xl
    font-semibold
    flex
    justify-center
    items-center
    gap-2
    ml-2
  "
      >
        Settings
      </div>
      <div className="flex flex-row flex-wrap justify-center items-center gap-2 mr-2">
        {props.hasChanges &&
          (props.isSaving ? (
            <RotatingLines className="app-button" size={"1.5rem"} />
          ) : (
            <NBDButton
              className={props.hasChanges ? "bg-orange-200" : ""}
              action={props.saveSettings}
            >
              Save changes
            </NBDButton>
          ))}
        <NBDButton action={props.restoreSettings}>Restore defaults</NBDButton>
      </div>
    </div>
  );
}

export { SettingsView };
