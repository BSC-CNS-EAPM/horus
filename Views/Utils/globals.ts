// Molstar wrapper
import HorusMolstar from "../Components/Molstar/HorusWrapper/horusmolstar";
import HorusSmilesManager from "../Components/Smiles/SmilesWrapper/horusSmiles";

// The settings object type
import { HorusSettingsObject } from "../Settings/setting";
import { ExtensionsFilePickerOptions } from "../Components/FileExplorer/file_explorer";

// Terminal ref
// @ts-ignore
import Terminal from "react-console-emulator";
import { getFile, saveFile } from "../Components/reusable";

export {};

// Declare global, window variables for the whole app
declare global {
  interface Window {
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
    molstar: HorusMolstar;
    // Smiles
    smiles?: HorusSmilesManager;
    // Console
    horusTerm: {
      ref: React.RefObject<Terminal> | null;
      storedMessages: string[];
    };
    // Horus flow builder
    horus: {
      getVariable?: () => any;
      setVariable?: (value: any) => void;
      getFlow?: () => any;
      setFlow?: (value: any) => void;
      openExtensionFilePicker?: (options: ExtensionsFilePickerOptions) => void;
      saveFile: (file: File) => void;
      getFile: (path: string) => Promise<Blob>;
    };
    // JSME viewer
    JSApplet: any;
    // OpenBabel
    obabel: any;
    // Extension data for blocks
    extensionData: any;
  }
}

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
};
