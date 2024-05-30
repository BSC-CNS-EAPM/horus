// React imports
import { useState, useEffect, useRef, useCallback } from "react";

// Horus imports
import Molstar from "../Molstar/molstar";
import HorusTerm from "../Console/console";
import { FlowBuilderView } from "../FlowBuilder/flow.view";
import HorusToolbar from "../Toolbar/toolbar";
import { PluginPage } from "../FlowBuilder/flow.types";

// Web-server tools
import { socket } from "../../Utils/socket";
import IFrameLoader from "../IframeLoader/iframeloader";

// Panels
import {
  Panel,
  PanelGroup,
  ImperativePanelHandle,
} from "react-resizable-panels";
import ResizeHandle from "../Panels/resize_handle";

// Molstar image logo
// @ts-ignore
import HorusLogo from "../../../Resources/horus-full.png";
import { ServerFileExplorerModal } from "../FileExplorer/file_explorer";

type WorkingViewProps = {
  extensionToOpen?: PluginPage;
  flowToOpen?: {
    savedID: string;
    path: string;
    template?: boolean;
  };
  molstar?: boolean;
};

export default function WorkingView(props: WorkingViewProps) {
  // States
  const [mainView, setMainView] = useState(<FlowBuilderView />);
  const [iframeView, setIframeView] = useState<React.ReactNode | null>(null);
  const [showIFrame, setShowIFrame] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(false);

  const handleMainView = (event: Event) => {
    const mainView = (event as CustomEvent).detail;
    setMainView(mainView);
  };

  const currentIframeBlockID = useRef<number>(-1);

  const iFrameRef = useRef<ImperativePanelHandle | null>(null);

  const handleIFrame = (event: Event) => {
    // Opening it from a block action yields a socket event
    const parsedEvent = event as CustomEvent;

    const page: PluginPage = parsedEvent.detail?.page ?? {};
    const url: string | null = page?.url ?? null;
    const pagename: string = page?.name ?? "Unknown";
    const data: any = parsedEvent.detail?.data ?? null;
    const blockIDCustom: number = parsedEvent.detail?.blockIDCustom ?? -1;

    // The block which provided the custom variable view unmounted,
    // Therefore we need to hide the current extension view
    if (blockIDCustom === currentIframeBlockID.current && !url) {
      setShowIFrame(false);
      return;
    }

    // An unmount event came from a custom block, but its not the currently displayed
    if (!url && blockIDCustom !== -1) {
      return;
    }

    // No url was provided, hidding the view
    if (!url) {
      setShowIFrame(false);
      return;
    }

    currentIframeBlockID.current = blockIDCustom;

    const key = url + "-" + pagename + Date.now().toString();
    setIframeView(<IFrameLoader key={key} page={page} data={data} />);

    // Make sure the panel is expanded too
    if (
      (iFrameRef.current && iFrameRef.current.getSize()! < 5) ||
      (iFrameRef.current && iFrameRef.current.getCollapsed()!)
    ) {
      iFrameRef.current?.expand();
    }
    setShowIFrame(true);
  };

  const toggleConsole = () => {
    setShowConsole((currentShowConsole) => !currentShowConsole);
  };

  const toggleFileExplorer = () => {
    setShowFileExplorer((currentShowFileExplorer) => !currentShowFileExplorer);
  };

  useEffect(() => {
    // Event listeners
    window.addEventListener("mainView", handleMainView);
    window.addEventListener("loadExtension", handleIFrame);
    window.addEventListener("toggleConsole", toggleConsole);
    window.addEventListener("toggleFileExplorer", toggleFileExplorer);
    socket.on("openExtension", handleIFrame);

    return () => {
      window.removeEventListener("mainView", handleMainView);
      window.removeEventListener("loadExtension", handleIFrame);
      window.removeEventListener("toggleConsole", toggleConsole);
      window.removeEventListener("toggleFileExplorer", toggleFileExplorer);
      socket.off("openExtension", handleIFrame);
    };
  }, []);

  const mainPanelRef = useRef<ImperativePanelHandle | null>(null);

  // Instantiate the HorusTerm in a ref
  // so that it is always available
  const term = useRef(<HorusTerm />);

  useEffect(() => {
    if (props.extensionToOpen) {
      // Create a fake event with the required data
      const extensionEvent: any = {
        detail: {
          page: props.extensionToOpen,
          // pagename: props.extensionToOpen.name,
          // url: props.extensionToOpen.url,
        },
      };
      handleIFrame(extensionEvent);

      // Collapse the main panel
      mainPanelRef.current?.collapse();
    }

    if (props.flowToOpen) {
      let event: CustomEvent | null = null;
      if (props.flowToOpen.savedID === "open") {
        event = new CustomEvent("openFlow", {
          detail: {},
        });
      } else {
        event = new CustomEvent("openFlow", {
          detail: {
            savedID: props.flowToOpen.savedID,
            path: props.flowToOpen.path,
            template: props.flowToOpen.template,
          },
        });
      }

      // Dispatch the event 1s after the component mounts
      // to allow the flow builder to mount
      if (event) {
        setTimeout(() => {
          window.dispatchEvent(event!);
        }, 1000);
      }
    }
  }, [props.extensionToOpen, props.flowToOpen]);

  return (
    <div className="root flex flex-col fade-in-animation zoom-out-animation">
      <HorusToolbar />
      <div className="flex flex-col w-full h-full">
        <PanelGroup direction="vertical">
          <Panel collapsible={true}>
            <PanelGroup direction="horizontal">
              <Panel
                ref={mainPanelRef}
                order={1}
                collapsible={true}
                defaultSize={props.extensionToOpen ? 0 : 50}
                minSize={30}
                id="flow-builder-panel"
              >
                {mainView}
              </Panel>
              {showIFrame && (
                <>
                  <ResizeHandle horizontal={true} />
                  <Panel
                    className="zoom-in-animation h-full"
                    id="iframe-panel"
                    ref={iFrameRef}
                    order={3}
                    collapsible={true}
                    defaultSize={props.extensionToOpen ? 100 : 50}
                  >
                    {iframeView}
                  </Panel>
                </>
              )}
            </PanelGroup>
          </Panel>
          <MolstarPanel expand={props.molstar} />
        </PanelGroup>
        <div className={showConsole ? "block" : "hidden"}>{term.current}</div>
      </div>
      {/* Used for the fileExplorer event */}
      {!window.horusInternal.isDesktop && showFileExplorer && (
        <ServerFileExplorerModal
          open={showFileExplorer}
          setOpen={setShowFileExplorer}
        />
      )}
    </div>
  );
}

function MolstarPanel({ expand }: { expand?: boolean }) {
  const [showMolstar, setShowMolstar] = useState<boolean>(true);
  const [initialMolstarHidden, setInitialMolstarHidden] = useState<boolean>(
    window.horusSettings["molstarHidden"]?.value && !expand
  );

  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Panels ref
  const molstarPanelRef = useRef<ImperativePanelHandle | null>(null);

  const toggleMolstar = useCallback(() => {
    if (initialMolstarHidden) {
      setInitialMolstarHidden(false);
      molstarPanelRef.current?.resize(30);
    }

    if (!showMolstar) {
      molstarPanelRef.current?.expand();
      setShowMolstar(true);
    } else {
      molstarPanelRef.current?.collapse();
      setShowMolstar(false);
    }
  }, [initialMolstarHidden, showMolstar]);

  const handleMolstarDrag = (dragging: boolean) => {
    setIsDragging(dragging);
  };

  const MolstarResizing = () => {
    return (
      <div className="flex justify-center items-center w-full h-full zoom-out-animation bg-white">
        <img
          src={HorusLogo}
          style={{
            height: "150px",
          }}
        />
      </div>
    );
  };

  useEffect(() => {
    window.addEventListener("toggleMolstar", toggleMolstar);

    return () => {
      window.removeEventListener("toggleMolstar", toggleMolstar);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMolstar, initialMolstarHidden]);

  return (
    <>
      <ResizeHandle onDragging={handleMolstarDrag} />
      <Panel
        className="bg-white"
        id="molstar-panel"
        order={2}
        collapsible={true}
        defaultSize={expand ? 100 : initialMolstarHidden ? 0 : 30}
        minSize={30}
        ref={molstarPanelRef}
        onCollapse={
          // Close molstar when the panel is collapsed
          () => {
            setShowMolstar(false);
          }
        }
        onResize={() => {
          if (
            molstarPanelRef.current &&
            molstarPanelRef.current.getSize()! > 0
          ) {
            setShowMolstar(true);
          }
        }}
      >
        <div className="w-full h-full">
          {isDragging && <MolstarResizing />}
          <div
            className="w-full h-full"
            style={{
              display: isDragging ? "none" : "block",
            }}
          >
            <Molstar options={{ showControls: expand }} />
          </div>
        </div>
      </Panel>
    </>
  );
}
