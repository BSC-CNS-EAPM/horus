import { PluginVariableTypes } from "../Components/FlowBuilder/flow.types";

export type HorusSettingsObject = {
  [key: string]: HorusSetting;
};

export type HorusSetting = {
  category: string;
  defaultValue: any;
  description: string;
  desktopOnly: boolean;
  name: string;
  type: PluginVariableTypes;
  allowedValues?: Array<any>;
  value: any;
  variables: Array<HorusSetting>;
};
