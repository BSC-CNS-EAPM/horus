// React
import { useCallback, useEffect, useRef, useState } from "react";

// Import the globals
import "../Utils/globals";

// Horus components
import SplashScreen from "../Components/MainApp/welcome_screen";
import { socket } from "../Utils/socket";
import RotatingLines from "../Components/RotatingLines/rotatinglines";

// Hooks
import { fetchSettings } from "../Settings/settings";
import { fetchDesktop } from "../Utils/utils";
import HorusContainer from "../Components/HorusContainer/horus_container";

export function App() {
  const [workingView, setWorkingView] = useState<React.ReactNode>(
    <div className="grid place-items-center h-screen bg-transparent">
      <div className="flex flex-col gap-2 items-center">
        <RotatingLines />
        Loading Horus...
      </div>
    </div>
  );

  const notRespondingContainer = useRef<HTMLDivElement>(null);
  const disconnectTimeout = useRef<Timer | null>(null);

  const getHorusSettings = async () => {
    // Store the settings in the window object
    await fetchSettings();

    // Set the global isDesktop variable
    await fetchDesktop();

    // Set the working view after the settings are fetched
    setWorkingView(<SplashScreen />);
  };

  const handleStartWorking = (event: CustomEvent) => {
    const startWorking = event.detail;
    setWorkingView(startWorking);
  };

  const displayServerInactive = useCallback(
    (show: boolean = true) => {
      if (notRespondingContainer.current) {
        if (show) {
          notRespondingContainer.current.style.display = "block";
        } else {
          notRespondingContainer.current.style.display = "none";
        }
      }
    },
    [notRespondingContainer.current]
  );

  const addDisconnectTimeout = useCallback(() => {
    disconnectTimeout.current = setTimeout(() => {
      displayServerInactive();
    }, 15000); // 15-second delay
  }, []);

  const addConnectTimeout = useCallback(() => {
    if (disconnectTimeout.current) {
      clearTimeout(disconnectTimeout.current); // Cancel the timeout if reconnected within 30 seconds
      disconnectTimeout.current = null;
    }
    displayServerInactive(false);
  }, [disconnectTimeout.current]);

  useEffect(() => {
    // Fetch the settings
    getHorusSettings();

    socket.on("disconnect", addDisconnectTimeout);

    socket.on("connect", addConnectTimeout);

    window.addEventListener("start-working", (e) => {
      handleStartWorking(e as CustomEvent);
    });

    return () => {
      window.removeEventListener("start-working", (e) => {
        handleStartWorking(e as CustomEvent);
      });

      socket.off("disconnect", addDisconnectTimeout);
      socket.off("connect", addConnectTimeout);
    };
  }, [addConnectTimeout, addDisconnectTimeout]);

  return (
    <>
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
      {workingView}
    </>
  );
}
