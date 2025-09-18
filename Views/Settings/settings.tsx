// React imports
import { useState, useEffect, useMemo } from "react";

// Horus web-server
import { horusGet, horusPost } from "../Utils/utils";

// Components
import AppButton from "../Components/appbutton";
import About from "../About/about";
import SidebarView from "../Components/SidebarView/sidebar_view";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import { PluginVariableView } from "../Components/FlowBuilder/Variables/variables";

// TS types
import {
  PluginVariable,
  PluginVariableTypes
} from "../Components/FlowBuilder/flow.types";
import { HorusSettingsObject } from "./setting";

// Import the css
import "../Components/FlowBuilder/Blocks/block.css";
import { useAlert } from "../Components/HorusPrompt/horus_alert";
import { useConfirm } from "../Components/HorusPrompt/horus_confirm";

export async function fetchSettings(
  forAdmin?: boolean
): Promise<HorusSettingsObject | null> {
  let response;
  if (forAdmin) {
    response = await horusGet("/users/admintools/settings");
  } else {
    response = await horusGet("/api/settings");
  }

  const data = await response.json();

  if (!data.ok) {
    alert("Error getting settings");
    return null;
  }

  // Store the settings
  window.horusSettings = data.settings as HorusSettingsObject;

  // Update the settings context
  if (window.horusInternal?.updateSettings) {
    window.horusInternal?.updateSettings(data.settings);
  }

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
      category: settings[settingID]?.category ?? "No category",
      name: settings[settingID]?.name ?? "Unnamed setting",
      description: settings[settingID]?.description ?? "No description",
      value: settings[settingID]?.value ?? null,
      defaultValue: settings[settingID]?.defaultValue ?? null,
      type: settings[settingID]?.type ?? PluginVariableTypes.ANY,
      allowedValues: settings[settingID]?.allowedValues ?? [],
      disabled: false,
      required: false,
      variables: (settings[settingID]?.variables ??
        []) as unknown as PluginVariable[]
    };
  });
}

export async function saveSettings({
  settings,
  forAdmin = false
}: {
  settings: PluginVariable[];
  forAdmin?: boolean;
}): Promise<any> {
  const header = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  const body = JSON.stringify({
    settings: settings
  });

  let response;
  if (forAdmin) {
    response = await horusPost("/users/admintools/savesettings", header, body);
  } else {
    response = await horusPost("/api/savesettings", header, body);
  }

  const data = await response.json();

  return data;
}

export function useSettings(forAdmin?: boolean) {
  const [settings, setSettings] = useState<PluginVariable[] | null>(null);
  const [groupedSettings, setGroupedSettings] = useState<
    Record<string, PluginVariable[]>
  >({});
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  const horusAlert = useAlert();
  const horusConfirm = useConfirm();

  async function getSettings() {
    setIsLoading(true);
    try {
      const settings = await fetchSettings(forAdmin);
      const parsedSettings = parseSettingsIntoPluginVariable(settings);

      // Group settings by .category
      let groupedSettings: Record<string, PluginVariable[]> = {};
      if (parsedSettings !== null) {
        groupedSettings = parsedSettings.reduce(
          (acc, setting) => {
            if (!acc[setting.category]) {
              acc[setting.category] = [];
            }
            acc[setting.category]!.push(setting);
            return acc;
          },
          {} as Record<string, PluginVariable[]>
        );
      }

      // Set the settings and the gruped variables
      setSettings(parsedSettings);
      setGroupedSettings(groupedSettings);
    } finally {
      setIsLoading(false);
    }
  }

  async function restoreSettings() {
    if (
      !(await horusConfirm(
        "Are you sure you want to restore the default settings?"
      ))
    ) {
      return;
    }

    const response = await horusGet("/api/restoreSettings");

    const data = await response.json();

    if (!data.ok) {
      await horusAlert("Error restoring settings");
      return;
    }

    getSettings();
  }

  const [isSaving, setIsSaving] = useState<boolean>(false);
  // Function to save settings
  const internalSaveSettings = async () => {
    setIsSaving(true);
    try {
      const data = await saveSettings({
        settings: settings ?? [],
        forAdmin: forAdmin
      });

      if (!data.ok) {
        await alert("Error saving settings");
      } else {
        // Update the settings
        await getSettings();

        // Send the "settingsChanged" event
        window.dispatchEvent(new CustomEvent("settingsChanged"));

        await new Promise((resolve) => setTimeout(resolve, 1000));

        setHasChanges(false);
      }

      setIsSaving(false);
    } finally {
      setIsSaving(false);
    }
  };

  const onSettingChange = (value: any, settingID: PluginVariable) => {
    if (settings === null) {
      return;
    }

    const setting = settings.find((setting) => setting.id === settingID.id)!;
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
    saveSettings: internalSaveSettings,
    onSettingChange,
    restoreSettings,
    isLoading
  };
}

function SettingsView({ forAdmin }: { forAdmin?: boolean }) {
  const {
    groupedSettings,
    hasChanges,
    isSaving,
    saveSettings,
    onSettingChange,
    restoreSettings,
    isLoading
  } = useSettings(forAdmin);

  const getGroupedSettings = () => {
    const groupedViews: Record<string, React.ReactNode[]> = {};

    for (const [category, settings] of Object.entries(groupedSettings)) {
      const variableViews = settings.map((setting) => {
        return (
          <PluginVariableView
            key={setting.id}
            variable={
              { ...setting, openOutsideFlowContext: true } as PluginVariable & {
                openOutsideFlowContext?: boolean;
              }
            }
            onChange={onSettingChange}
          />
        );
      });
      groupedViews[category] = [
        <div className="flex flex-col gap-2 flex-wrap" key={category}>
          {variableViews}
        </div>
      ];
    }

    // Add the "About" page as a view
    groupedViews["About Horus"] = [<About key={"about-horus"} />];

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
          <div className="m-auto mb-2 mt-2 p-4 flex font-semibold justify-center items-center w-48 h-full">
            {isLoading ? <RotatingLines /> : "No settings found"}
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
            <AppButton
              className={props.hasChanges ? "bg-orange-200" : ""}
              action={props.saveSettings}
            >
              Save changes
            </AppButton>
          ))}
        <AppButton action={props.restoreSettings}>Restore defaults</AppButton>
      </div>
    </div>
  );
}

export { SettingsView };
