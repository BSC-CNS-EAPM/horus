import Molstar from "../Components/Molstar/molstar";
import HorusToolbar from "../Components/Toolbar/toolbar";
import HorusTerm from "../Components/Console/console";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import FlowBuilder from "../Components/FlowBuilder/flow_builder";
import IFrameLoader from "../Components/IframeLoader/iframeloader";

export default function ResizeHandle({
  horizontal = false,
}: {
  horizontal?: boolean;
}) {
  const horizontalIcon = horizontal ? "Icon Icon-horizontal" : "Icon";

  return (
    <PanelResizeHandle className="ResizeHandleOuter">
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
  const [mainView, setMainView] = useState(<FlowBuilder />);
  const [showConsole, setShowConsole] = useState(false);

  const handleMainView = (event) => {
    const mainView = event.detail;
    setMainView(mainView);
  };

  const handleIFrame = (event) => {
    const key = event.detail.url + "-" + event.detail.pagename;
    const iframe = <IFrameLoader key={key} {...event.detail} />;
    setMainView(iframe);
  };

  const toggleConsole = () => {
    setShowConsole((currentShowConsole) => !currentShowConsole);
  };

  useEffect(() => {
    window.addEventListener("mainView", handleMainView);
    window.addEventListener("mainViewURL", handleIFrame);
    window.addEventListener("toggleConsole", toggleConsole);

    return () => {
      window.removeEventListener("mainView", handleMainView);
      window.removeEventListener("mainViewURL", handleIFrame);
      window.removeEventListener("toggleConsole", toggleConsole);
    };
  }, []);

  const mainViewPanel = (
    <>
      <Panel minSize={30} order={3}>
        {mainView}
      </Panel>
      <ResizeHandle horizontal={true} />
    </>
  );

  const molstarPanel = (
    <Panel minSize={30} order={4} collapsible={true} defaultSize={0}>
      <Molstar />
    </Panel>
  );

  const consolePanel = (
    <>
      <ResizeHandle />
      <Panel minSize={8} maxSize={50} order={2} defaultSize={20}>
        <HorusTerm />
      </Panel>
    </>
  );

  return (
    <div className="grid">
      <HorusToolbar />
      <div id="root-routes" className="root-routes root-routes-console-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <PanelGroup direction="vertical">
                <Panel order={1}>
                  <PanelGroup direction="horizontal">
                    {mainViewPanel}
                    {molstarPanel}
                  </PanelGroup>
                </Panel>
                {showConsole && consolePanel}
              </PanelGroup>
            }
          />
        </Routes>
      </div>
      <HorusTerm />
    </div>
  );
}
