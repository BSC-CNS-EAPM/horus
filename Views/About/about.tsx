import { useState, useEffect } from "react";

// Horus web-server utils
import { horusGet } from "../Utils/utils";

// @ts-ignore
import HorusLogo from "../../Resources/horus.png";
import { useAlert } from "../Components/HorusPrompt/horus_alert";

type AppInfo = {
  APP_VERSION: string;
  platform: string;
  debug: boolean;
  mode: string;
  appSupportDir: string;
  PYTHON_VERSION: string;
};

export default function About() {
  const [appInfo, setAppInfo] = useState<AppInfo>({
    APP_VERSION: "Unknown",
    platform: "Unknown",
    debug: false,
    mode: "Unknown",
    appSupportDir: "Unknown",
    PYTHON_VERSION: "Unknown",
  } as AppInfo);

  const horusAlert = useAlert();

  const getVersion = async () => {
    const response = await horusGet("/api/version");
    if (!response.ok) {
      console.error("Error getting application info");
      return;
    }
    const data = await response.json();

    if (!data.ok) {
      await horusAlert("Error getting application info: " + data.msg);
      return;
    }

    const appInfo: AppInfo = data.appINFO;

    setAppInfo(appInfo);
  };

  useEffect(() => {
    getVersion();
  }, []);

  return (
    <div className="flex flex-row flex-wrap justify-around items-center overflow-hidden h-full w-full ">
      <div className="flex flex-col gap-2">
        <div className="p-2 horus-container animated-gradient text-black">
          Version: {appInfo.APP_VERSION}
        </div>
        <div className="p-2 horus-container animated-gradient text-black">
          Platform: {appInfo.platform}
        </div>
        <div className="p-2 horus-container animated-gradient text-black">
          Mode: {appInfo.mode.toUpperCase()}
        </div>
        {appInfo.debug && (
          <div className="p-2 horus-container animated-gradient text-orange-400 font-semibold">
            Debug mode enabled - Python version: {appInfo.PYTHON_VERSION}
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 justify-center items-center">
        <img
          src={HorusLogo}
          alt="Horus Logo"
          className="object-fit"
          width={100}
        />
        <a
          className="app-button text-black text-decoration-none"
          href="https://nbdsoftware.github.io/horus/index.html"
          target="_blank"
        >
          Horus documentation
        </a>
      </div>
    </div>
  );
}
