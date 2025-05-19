// Molstar wrapper
import HorusMolstar, {
  LoadMoleculeFileType,
} from "../Components/Molstar/HorusWrapper/horusmolstar";
import HorusSmilesManager, {
  HorusSmilesType,
} from "../Components/Smiles/SmilesWrapper/horusSmiles";

// The settings object type
import { HorusSettingsObject } from "../Settings/setting";
import { ExtensionsFilePickerOptions } from "../Components/FileExplorer/file_explorer";

// Terminal ref
// @ts-ignore
import Terminal from "react-console-emulator";
import { getFile, saveFile, updateFile } from "../Components/reusable";
import {
  Flow,
  PluginPageExtensionEvent,
} from "@/Components/FlowBuilder/flow.types";
import { Dispatch, SetStateAction } from "react";

export {};

// Declare global, window variables for the whole app
declare global {
  interface Window {
    // Under root path
    __HORUS_ROOT__: string;
    // App mode
    horusInternal: {
      isDesktop: boolean;
      mode: "server" | "app" | "browser" | "webapp";
      debug: boolean;
      webApp?: {
        appName: string;
        companyName: string;
        requireRegistration: boolean;
        allowRemotes: boolean;
        allowDemoUser: boolean;
        uploadSize: number;
      };
      updateSettings: (settings: HorusSettingsObject) => void;
    };
    // Socket connection ID
    socketiosid: string | null;
    // pywebview App mode
    pywebview: {
      token: string;
    };
    // Settings
    horusSettings: HorusSettingsObject;
    // Molstar
    molstar?: HorusMolstar | { loadMoleculeFile: LoadMoleculeFileType };
    // Smiles
    smiles?: HorusSmilesManager;
    // Console
    horusTerm: {
      ref: React.RefObject<Terminal> | null;
    };
    // Horus flow builder
    horus: {
      getVariable?: () => any;
      setVariable?: (value: any) => void;
      getFlow?: () => any;
      setFlow?: (newFlow: Flow) => void;
      setExtraData?: (key: string, value: any) => void;
      getExtraData?: (key: string) => any;
      openExtensionFilePicker?: (options: ExtensionsFilePickerOptions) => void;
      saveFile: (file: File) => void;
      updateFile: (file: File, path: string) => void;
      getFile: (path: string) => Promise<Blob>;
      openFile: (path: string) => Promise<void>;
      setTabTitle?: (tabTitle: string) => void;
      closeTab?: () => void;
      openPanel?: openPanel;
      closePanel?: (id: string) => void;
      addExtensions?: (e: PluginPageExtensionEvent) => void;
    };
    // JSME viewer
    JSApplet: any;
    // OpenBabel
    obabel: any;
    // Extension data for blocks
    extensionData: any;
  }
}

export type openPanel = {
  (type: "flow" | "molstar" | "smiles" | "terminal"): void;
  (
    type: "moleculePlotter",
    id: string,
    params: { smilesToPlot: HorusSmilesType[] }
  ): void;
  (
    type: "extensions",
    id: string,
    params: {
      name: string;
      plugin: string;
      id: string;
      data?: any;
    }
  ): void;
};

export enum GLOBAL_IDS {
  FLOW_BUILDER_DIV = "flow-builder-div",
  EXTENSIONS_IFRAME = "extensions-iframe",
  EXTENSIONS_FILEPICKER = "extensions-filepicker",
  FLOW_BUILDER_CONTAINER = "flow-builder-container",
}

// Define an empty window.horus object
window.horus = {
  saveFile: saveFile,
  getFile: getFile,
  updateFile: updateFile,
  openFile: async () => {
    alert("Open the flow editor before opnening files");
  },
};
