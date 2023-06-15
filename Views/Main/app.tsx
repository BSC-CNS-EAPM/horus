import Molstar from "../Components/Molstar/molstar";
import HorusToolbar from "../Components/Toolbar/toolbar";
import HorusTerm from "../Components/Console/console";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

export default function ResizeHandle({
  className = "",
  id,
}: {
  className?: string;
  id?: string;
}) {
  return (
    <PanelResizeHandle className="ResizeHandleOuter">
      <div className="ResizeHandleInner">
        <svg className="Icon" viewBox="0 0 24 24">
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

  const handleSecondView = (event) => {
    const secondView = event.detail;

    setSecondView(secondView);
  };

  useEffect(() => {
    window.addEventListener("secondView", handleSecondView);

    return () => {
      window.removeEventListener("secondView", handleSecondView);
    };
  }, []);

  return (
    <div className="grid">
      <HorusToolbar />
      <div id="root-routes" className="root-routes root-routes-console-hidden">
        <Routes>
          <Route
            path="/"
            element={
              <PanelGroup direction="horizontal">
                {secondView && (
                  <>
                    <Panel minSize={30} order={1}>
                      {secondView}
                    </Panel>
                    <ResizeHandle />
                  </>
                )}
                <Panel minSize={30} order={2}>
                  <Molstar />
                </Panel>
              </PanelGroup>
            }
          />
        </Routes>
      </div>
      <HorusTerm />
    </div>
  );
}
