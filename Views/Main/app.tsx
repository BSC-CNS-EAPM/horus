import Molstar from "../Components/Molstar/molstar";
import HorusToolbar from "../Components/Toolbar/toolbar";
import HorusTerm from "../Components/Console/console";
import { useEffect, useRef, useState } from "react";
import { Route, Routes } from "react-router";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  ImperativePanelHandle,
} from "react-resizable-panels";
import { FlowBuilderView } from "../Components/FlowBuilder/flow_builder_view";
import IFrameLoader from "../Components/IframeLoader/iframeloader";
import { socket } from "../Utils/socket";
import { fetchDesktop, horusGet } from "../Utils/utils";

declare global {
  interface Window {
    isDesktop: boolean;
    horusSettings: any;
    horus: {
      getVariable?: () => any;
      setVariable?: (value: any) => void;
      getFlow?: () => any;
      setFlow?: (value: any) => void;
    };
  }
}

// Define an empty window.horus object
window.horus = {};

export default function ResizeHandle({
  horizontal = false,
  molstar = false,
}: {
  horizontal?: boolean;
  molstar?: boolean;
}) {
  const horizontalIcon = horizontal ? "Icon Icon-horizontal" : "Icon";

  const reloadMolstar = (e) => {
    if (e) {
      const molstar = window.molstar;
      if (molstar) {
        // molstar.unload();
      }
    } else {
      const molstar = window.molstar;
      if (molstar) {
        // molstar.redispose();
      }
    }
  };

  const iframePointer = (e) => {
    if (e) {
      const iframe = document.getElementById("iframe-loader");
      if (iframe) {
        iframe.style.pointerEvents = "none";
      }
    } else {
      const iframe = document.getElementById("iframe-loader");
      if (iframe) {
        iframe.style.pointerEvents = "auto";
      }
    }
  };

  const handleOnDragging = (e) => {
    if (molstar) {
      reloadMolstar(e);
    }

    iframePointer(e);
  };

  return (
    <PanelResizeHandle
      className="ResizeHandleOuter"
      onDragging={handleOnDragging}
    >
      <div className="ResizeHandleInner">
        <svg className={horizontalIcon} viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M8,18H11V15H2V13H22V15H13V18H16L12,22L8,18M12,2L8,6H11V9H2V11H22V9H13V6H16L12,2Z"
          />
        </svg>
      </div>
    </PanelResizeHandle>
  );
}

export function App() {
  // States
  const [mainView, setMainView] = useState(<FlowBuilderView />);
  const [iframeView, setIframeView] = useState(null);
  const [showIFrame, setShowIFrame] = useState(false);
  const [showConsole, setShowConsole] = useState(false);

  // Panels ref
  const molstarPanelRef = useRef<ImperativePanelHandle | null>(null);

  const handleMainView = (event) => {
    const mainView = event.detail;
    setMainView(mainView);
  };

  const handleIFrame = (event) => {
    // Opening it from a block action yields a socket event
    const hasPageURL = event?.pageURL;

    let newEvent = event;
    if (hasPageURL) {
      // Create a new fake event object
      newEvent = {
        detail: {
          pagename: event.title,
          url: event.pageURL,
          data: event?.data,
        },
      };
    }

    // Opening a new page from the GUI yields a regular JS event
    const hasURL = newEvent?.detail?.url;

    if (!hasURL) {
      setShowIFrame(false);
      return;
    }

    const key = newEvent.detail.url + "-" + newEvent.detail.pagename;
    const iframe = <IFrameLoader key={key} {...newEvent.detail} />;
    setIframeView(iframe);
    setShowIFrame(true);
  };

  const toggleConsole = () => {
    setShowConsole((currentShowConsole) => !currentShowConsole);
  };

  const handlePanelSettings = () => {
    // Get the "molstarHidden" setting
    const molstarHidden = window.horusSettings.find(
      (setting) => setting.id === "molstarHidden"
    ).setting.value;

    if (molstarHidden === true) {
      // Hide the molstar panel
      molstarPanelRef.current?.collapse();
    }
  };

  const getHorusSettings = async () => {
    const data = await horusGet("/api/settings").then((response) =>
      response.json()
    );

    if (!data.ok) {
      alert("Error getting settings");
      return;
    }

    const settings = data.settings;
    // Store the settings in the window object
    window.horusSettings = settings;

    // Handle the panel settings as are needed when mounting this view
    handlePanelSettings();
  };

  useEffect(() => {
    // Event listeners
    window.addEventListener("mainView", handleMainView);
    window.addEventListener("mainViewURL", handleIFrame);
    window.addEventListener("toggleConsole", toggleConsole);
    socket.on("openExtension", handleIFrame);

    // Set the global isDesktop variable
    fetchDesktop();

    // Get the horus settings
    getHorusSettings();

    return () => {
      window.removeEventListener("mainView", handleMainView);
      window.removeEventListener("mainViewURL", handleIFrame);
      window.removeEventListener("toggleConsole", toggleConsole);
      socket.off("openExtension", handleIFrame);
    };
  }, []);

  const mainViewPanel = (
    <>
      <Panel order={3} collapsible={true}>
        {mainView}
      </Panel>
    </>
  );

  const molstarPanel = (
    <>
      <ResizeHandle horizontal={true} molstar={true} />
      <Panel
        order={5}
        collapsible={true}
        defaultSize={50}
        ref={molstarPanelRef}
      >
        <Molstar />
      </Panel>
    </>
  );

  // Instantiate the HorusTerm in a ref
  // so that it is always available
  const term = useRef(<HorusTerm />);

  const iFrameRef = useRef(null);

  const iframeViewPanel = (
    <>
      <ResizeHandle horizontal={true} />
      <Panel
        ref={iFrameRef}
        order={4}
        collapsible={true}
        defaultSize={50}
        onCollapse={
          // Close the iframe when the panel is collapsed
          () => {
            // setShowIFrame(false);
            // const size = iFrameRef.current.getSize();
            // console.log("size", size);
            // if (size === 30) {
            //   setShowIFrame(false);
            // }
          }
        }
      >
        {iframeView}
      </Panel>
    </>
  );

  return (
    <div className="grid">
      <HorusToolbar />
      <div id="root-routes" className="flex flex-col root-routes">
        <Routes>
          <Route
            path="/"
            element={
              <PanelGroup direction="vertical">
                <Panel order={1}>
                  <PanelGroup direction="horizontal">
                    {mainViewPanel}
                    {showIFrame && iframeViewPanel}
                    {molstarPanel}
                  </PanelGroup>
                </Panel>
              </PanelGroup>
            }
          />
        </Routes>
        {showConsole && term.current}
      </div>
    </div>
  );
}
