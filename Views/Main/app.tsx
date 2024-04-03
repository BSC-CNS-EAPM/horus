// React
import { useEffect, useState } from "react";

// Import the globals
import "../Utils/globals";

// Horus components
import SplashScreen from "../Components/MainApp/welcome_screen";
import { socket } from "../Utils/socket";
import { BlurredModal } from "../Components/reusable";
import RotatingLines from "../Components/RotatingLines/rotatinglines";

// Hooks
import { fetchSettings } from "../Settings/settings";
import { fetchDesktop } from "../Utils/utils";

export function App() {
  const [workingView, setWorkingView] = useState<React.ReactNode>(
    <div className="grid place-items-center h-screen bg-transparent">
      <div className="flex flex-col gap-2 items-center">
        <RotatingLines />
        Loading Horus...
      </div>
    </div>
  );

  const [serverActive, setServerActive] = useState<boolean>(true);

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

  useEffect(() => {
    // Fetch the settings
    getHorusSettings();

    socket.on("disconnect", () => {
      setServerActive(false);
    });

    socket.on("connect", () => {
      setServerActive(true);
    });

    window.addEventListener("start-working", (e) => {
      handleStartWorking(e as CustomEvent);
    });

    return () => {
      window.removeEventListener("start-working", (e) => {
        handleStartWorking(e as CustomEvent);
      });
    };
  }, []);

  return (
    <>
      <BlurredModal show={!serverActive} onHide={() => {}} zIndex={99999}>
        <div className="flex flex-col gap-2 text-center justify-center items-center">
          <div className="text-xl font-semibold">
            Could not connect to the Horus server
          </div>
          <RotatingLines />
          <div>Trying to restablish connection...</div>
        </div>
      </BlurredModal>
      {workingView}
    </>
  );
}
