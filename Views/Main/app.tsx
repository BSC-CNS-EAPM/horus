// React
import { createContext, useContext, useEffect, useRef, useState } from "react";

// Import the globals
import "../Utils/globals";

// Horus components
import { socket } from "../Utils/socket";
import RotatingLines from "../Components/RotatingLines/rotatinglines";

// Hooks
import { fetchSettings } from "../Settings/settings";
import { fetchDesktop } from "../Utils/utils";
import {
  NavigateFunction,
  NavigateOptions,
  Outlet,
  To,
  useNavigate,
} from "react-router";
import { setNavigate } from "@/Utils/navigationService";
import HorusContainer from "@/Components/HorusContainer/horus_container";
import { HorusSettingsObject } from "@/Settings/setting";
import { checkCookies } from "@/Utils/CustomHooks/cookies";

export const SettingsContext = createContext<HorusSettingsObject | null>(null);

export function useSettings() {
  return useContext(SettingsContext);
}

export function App() {
  const [isHorusLoaded, setIsHorusLoaded] = useState(false);
  const [horusSettingsState, setHorusSettings] =
    useState<HorusSettingsObject | null>(null);

  const notRespondingContainer = useRef<HTMLDivElement>(null);
  const disconnectTimeout = useRef<Timer | null>(null);

  const getHorusSettings = async () => {
    // Store the settings in the context state
    setHorusSettings(await fetchSettings());

    // Set the global isDesktop variable
    await fetchDesktop();

    checkCookies();

    // Set the working view after the settings are fetched
    setIsHorusLoaded(true);
  };

  useEffect(() => {
    // Fetch the settings
    getHorusSettings();

    // Set the settings updater
    window.horusInternal = {
      ...window.horusInternal,
      updateSettings: (s: HorusSettingsObject) => {
        setHorusSettings(s);
      },
    };

    const displayServerInactive = (show: boolean = true) => {
      if (notRespondingContainer.current) {
        if (show) {
          notRespondingContainer.current.style.display = "block";
        } else {
          notRespondingContainer.current.style.display = "none";
        }
      }
    };

    const addDisconnectTimeout = () => {
      disconnectTimeout.current = setTimeout(() => {
        displayServerInactive();
      }, 15000); // 15-second delay
    };

    const addConnectTimeout = () => {
      if (disconnectTimeout.current) {
        clearTimeout(disconnectTimeout.current); // Cancel the timeout if reconnected within 30 seconds
        disconnectTimeout.current = null;
      }
      displayServerInactive(false);
    };

    socket.on("disconnect", addDisconnectTimeout);

    socket.on("connect", addConnectTimeout);

    return () => {
      socket.off("disconnect", addDisconnectTimeout);
      socket.off("connect", addConnectTimeout);
    };
  }, []);

  const navigate = useNavigate();

  useEffect(() => {
    const updatedNavigate: NavigateFunction = (
      toOrDelta: To | number,
      options?: NavigateOptions
    ) => {
      if (typeof toOrDelta === "number") {
        navigate(toOrDelta);
      } else {
        const fixedURL = window.__HORUS_ROOT__ + toOrDelta;
        navigate(fixedURL, options);
      }
    };

    setNavigate(updatedNavigate);
  }, [navigate]);

  if (!isHorusLoaded) {
    return (
      <div className="grid place-items-center h-screen bg-transparent">
        <div className="flex flex-col gap-2 items-center">
          <RotatingLines />
          Loading Horus...
        </div>
      </div>
    );
  }

  return (
    <SettingsContext.Provider value={horusSettingsState}>
      <HorusContainer
        className="zoom-in-animation"
        ref={notRespondingContainer}
        style={{
          display: "none",
          position: "absolute",
          bottom: "0.5rem",
          right: "0.5rem",
          zIndex: 99999,
          padding: "1rem",
          border: "1.5px solid red",
        }}
      >
        <div className="flex flex-col gap-1 text-center justify-center items-center">
          <div className="text-xl font-semibold">Horus is not responding</div>
          <span></span>
          <div className="flex flex-row gap-2 text-center justify-center items-center">
            Changes will not be saved. Trying to reconnect...
            <RotatingLines size="20px" />
          </div>
        </div>
      </HorusContainer>
      <Outlet />
    </SettingsContext.Provider>
  );
}
