// Molstar wrapper
import HorusMolstar from "../Components/Molstar/HorusWrapper/horusmolstar";
// The settings object type
import { HorusSettingsObject } from "../Settings/setting";

// Terminal ref
// @ts-ignore
import Terminal from "react-console-emulator";

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
    };
    // Extension data for blocks
    extensionData: any;
  }
}

// Define an empty window.horus object
window.horus = {};
