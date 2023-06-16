import Molstar from "../Components/Molstar/molstar";
import HorusToolbar from "../Components/Toolbar/toolbar";
import HorusTerm from "../Components/Console/console";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

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
  const [secondView, setSecondView] = useState(null);
  const [showConsole, setShowConsole] = useState(false);

  const handleSecondView = (event) => {
    const secondView = event.detail;

    setSecondView(secondView);
  };

  const toggleConsole = () => {
    setShowConsole((currentShowConsole) => !currentShowConsole);
  };

  useEffect(() => {
    window.addEventListener("secondView", handleSecondView);
    window.addEventListener("toggleConsole", toggleConsole);

    return () => {
      window.removeEventListener("secondView", handleSecondView);
      window.removeEventListener("toggleConsole", toggleConsole);
    };
  }, []);

  const secondViewPanel = (
    <>
      <Panel minSize={30} order={1}>
        {secondView}
      </Panel>
      <ResizeHandle horizontal={true} />
    </>
  );

  const molstarPanel = (
    <Panel minSize={30}>
      <Molstar />
    </Panel>
  );

  const consolePanel = (
    <>
      <ResizeHandle />
      <Panel minSize={30}>
        <HorusTerm />
      </Panel>
    </>
  );

  const molstarTerminalPanel = (
    <Panel minSize={30} order={2}>
      <PanelGroup direction="vertical">
        {molstarPanel}
        {showConsole && consolePanel}
      </PanelGroup>
    </Panel>
  );

  return (
    <div className="grid">
      <HorusToolbar />
      <div id="root-routes" className="root-routes root-routes-console-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <PanelGroup direction="horizontal">
                {secondView && secondViewPanel}
                {molstarTerminalPanel}
              </PanelGroup>
            }
          />
        </Routes>
      </div>
      <HorusTerm />
    </div>
  );
}
