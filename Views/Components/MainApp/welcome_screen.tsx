// React
import { useEffect, useState } from "react";

// Views
import HorusContainer from "../HorusContainer/horus_container";
import WorkingView from "./working_view";
import RecentUserFlows, {
  PredefinedFlows,
  useGetRecentFlows,
} from "../FlowStatus/recent_flows";
import RotatingLines from "../RotatingLines/rotatinglines";
import PluginPagesView, { usePluginPages } from "../Toolbar/extensions_list";
import WebAppUserFlows from "../WebAppUserFlows/WebAppUserFlows";
import ConfigRemotes from "../../Remotes/remotes";
import Profile from "../../Login/profile";
import { HorusModal } from "../reusable";
import { PluginManager } from "../../PluginsManager/plugin_manager";
import { TemplatesView } from "../Templates/templates";
import { SettingsView } from "../../Settings/settings";

// TS types
import { PluginPage } from "../FlowBuilder/flow.types";

// Icons
import NewFlowIcon from "../Toolbar/Icons/New";
import PluginsIcon from "../Toolbar/Icons/Plugins";
import SettingsIcon from "../Toolbar/Icons/Settings";
import ServerIcon from "../Toolbar/Icons/Server";
import OpenFlowIcon from "../Toolbar/Icons/Open";
import TemplateIcon from "../Toolbar/Icons/Template";
import Login from "../Toolbar/Icons/Login";
import UserIcon from "../Toolbar/Icons/User";

// Import the horus logo
import Logo from "../logo";
import MolStarIcon from "../Toolbar/Icons/MolStar";

type SplashModal = {
  header?: React.ReactNode;
  body: React.ReactNode;
  footer?: React.ReactNode;
  allowBlurClose?: boolean;
};

export default function SplashScreen() {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<SplashModal | null>(null);

  const updateModalContent = (modal: SplashModal | null) => {
    if (modal) {
      setModalContent(modal);
      setShowModal(true);
    } else {
      setShowModal(false);
    }
  };

  return (
    <>
      <WelcomeToHorus setModalContent={updateModalContent} />
      <div className="splash-container h-full grid place-items-center gap-4 items-center">
        <div className="flex flex-row flex-wrap justify-center items-center w-full gap-8 zoom-in-animation text-white">
          <div className="flex gap-2 p-2 flex-wrap justify-center flex-direction-splash-buttons">
            <CreateNewFlow />
            {!window.horusInternal.webApp && <OpenFlow />}
            <OpenMolstar />
            <ManageTemplates setModalContent={updateModalContent} />
            {!window.horusInternal.webApp && (
              <ManagePlugins setModalContent={updateModalContent} />
            )}
            {window.horusInternal.webApp?.allowRemotes !== false && (
              <ManageRemotes setModalContent={updateModalContent} />
            )}
            <ManageSettings setModalContent={updateModalContent} />
          </div>
          <div className="vertical-splash-separator" />
          <div className="flex flex-row flex-wrap gap-2 justify-center">
            {window.horusInternal.mode === "webapp" ? (
              <PredefinedFlowsSplash />
            ) : (
              <RecentFlowsSplash />
            )}
            <ExploreExtensions />
          </div>
        </div>
        {window.horusInternal.mode === "webapp" && <WebAppUserFlows />}
      </div>
      {modalContent && (
        <ModalView
          modal={modalContent}
          isOpen={showModal}
          onHide={() => setShowModal(false)}
        />
      )}
    </>
  );
}

function ModalView(props: {
  modal: SplashModal;
  isOpen: boolean;
  onHide: () => void;
}) {
  return (
    <HorusModal
      id="home-modal"
      show={props.isOpen}
      header={props.modal.header}
      footer={props.modal.footer}
      onHide={props.modal.allowBlurClose ?? true ? props.onHide : () => {}}
      size="xl"
      noCentered
    >
      {props.modal.body}
    </HorusModal>
  );
}

function WelcomeToHorus(props: {
  setModalContent: (modal: SplashModal) => void;
}) {
  const appName = window.horusInternal.webApp?.appName || "Horus";
  const loginRequried =
    window.horusInternal.webApp?.requireRegistration || false;

  return (
    <HorusContainer
      className="sticky-app-header flex flex-row items-center justify-between px-2 w-full bg-white"
      style={{
        position: "sticky",
        zIndex: 200,
        top: "0",
        borderTop: "none",
        borderLeft: "none",
        borderRight: "none",
        borderRadius: "0",
        width: "100%",
      }}
    >
      <div>
        <Logo className="h-16" />
      </div>
      <div className="flex justify-center items-center w-full font-semibold absolute mx-auto">
        {appName}
      </div>
      {loginRequried && (
        <div className="flex flex-row gap-2 z-10">
          <UserIcon
            style={{
              cursor: "pointer",
            }}
            onClick={() => {
              props.setModalContent({
                body: <Profile />,
              });
            }}
          />
          <a
            className="flex flex-row gap-2 items-center text-decoration-none"
            style={{
              color: "var(--digital-grey-IV)",
            }}
            href="/users/logout"
          >
            <Login />
          </a>
        </div>
      )}
    </HorusContainer>
  );
}

function CreateNewFlow() {
  const handleCreateNewFlow = () => {
    // Set the startWorking view
    const startWorkingEvent = new CustomEvent("start-working", {
      detail: <WorkingView />,
    });

    window.dispatchEvent(startWorkingEvent);
  };

  return (
    <HorusContainer onClick={handleCreateNewFlow} className="zoom-on-hover">
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full cursor-default w-[150px]">
        <NewFlowIcon className="w-6 h-6 icon" />
        New flow
      </div>
    </HorusContainer>
  );
}

function OpenMolstar() {
  const handleOpenMolstar = () => {
    // Set the startWorking view
    const startWorkingEvent = new CustomEvent("start-working", {
      detail: <WorkingView molstar={true} />,
    });

    window.dispatchEvent(startWorkingEvent);
  };

  return (
    <HorusContainer onClick={handleOpenMolstar} className="zoom-on-hover">
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full cursor-default w-[150px]">
        <MolStarIcon className="w-6 h-6 icon" />
        Viewer
      </div>
    </HorusContainer>
  );
}

function OpenFlow() {
  const handleOpenFlow = () => {
    // Set the startWorking view
    const startWorkingEvent = new CustomEvent("start-working", {
      detail: (
        <WorkingView
          flowToOpen={{
            savedID: "open",
            path: "open",
          }}
        />
      ),
    });

    window.dispatchEvent(startWorkingEvent);
  };

  return (
    <HorusContainer onClick={handleOpenFlow} className="zoom-on-hover">
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full cursor-default w-[150px]">
        <OpenFlowIcon className="w-6 h-6 icon" />
        Open flow
      </div>
    </HorusContainer>
  );
}

type ButtonOpensModalProps = {
  setModalContent: (modal: SplashModal | null) => void;
};

function ManageTemplates(props: ButtonOpensModalProps) {
  const setModalContent = () => {
    props.setModalContent({
      body: <TemplatesView />,
    });
  };

  return (
    <HorusContainer className="zoom-on-hover" onClick={setModalContent}>
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full cursor-default w-[150px]">
        <TemplateIcon className="w-6 h-6 icon" />
        Templates
      </div>
    </HorusContainer>
  );
}

function ManagePlugins(props: ButtonOpensModalProps) {
  const setModalContent = () => {
    const footer = (
      <a
        className="app-button text-black text-decoration-none"
        href="https://horus.bsc.es/docs/developer_guide/horusapi/plugins.html"
        target="_blank"
      >
        Learn more about plugins
      </a>
    );

    props.setModalContent({
      body: <PluginManager />,
      footer: footer,
    });
  };

  return (
    <HorusContainer className="zoom-on-hover" onClick={setModalContent}>
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full cursor-default w-[150px]">
        <PluginsIcon className="w-6 h-6 icon" />
        Plugins
      </div>
    </HorusContainer>
  );
}

function ManageRemotes(props: ButtonOpensModalProps) {
  const setModalContent = () => {
    const body = <ConfigRemotes />;

    props.setModalContent({
      body: body,
    });
  };

  return (
    <HorusContainer className="zoom-on-hover" onClick={setModalContent}>
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full cursor-default w-[150px]">
        <ServerIcon className="w-6 h-6 icon" />
        Remotes
      </div>
    </HorusContainer>
  );
}
function ManageSettings(props: ButtonOpensModalProps) {
  const setModalContent = () => {
    const body = <SettingsView />;

    props.setModalContent({
      body: body,
    });
  };

  return (
    <HorusContainer className="zoom-on-hover" onClick={setModalContent}>
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full cursor-default w-[150px]">
        <SettingsIcon className="w-6 h-6 icon" />
        Settings
      </div>
    </HorusContainer>
  );
}

// When running webapp mode, instead of showing the recent flows
// we show the predefined flows. As the recents will be shown in the "Your flows"
// section of the webapp
function PredefinedFlowsSplash() {
  // Get the predefined flows with the custom hook
  const [fetchingRecents, , predefinedFlows, , , toggleInterval] =
    useGetRecentFlows();

  useEffect(() => {
    toggleInterval(false);
  }, [toggleInterval]);

  return (
    <ScrollableViewWelcome.Root>
      <ScrollableViewWelcome.Header>
        <div className="text-xl font-semibold">Preset flows</div>
      </ScrollableViewWelcome.Header>
      <ScrollableViewWelcome.Body>
        {fetchingRecents ? (
          <div className="h-full flex justify-center items-center">
            <RotatingLines />
          </div>
        ) : (
          <div className="w-full h-full">
            {predefinedFlows.length === 0 ? (
              <div className="h-full flex justify-center items-center">
                No preset flows
              </div>
            ) : (
              <PredefinedFlows flows={predefinedFlows} />
            )}
          </div>
        )}
      </ScrollableViewWelcome.Body>
      <ScrollableViewWelcome.Footer>
        <a
          className="app-button text-black text-decoration-none"
          href="https://horus.bsc.es/docs/running_flows/index.html"
          target="_blank"
        >
          Learn more about flows
        </a>
      </ScrollableViewWelcome.Footer>
    </ScrollableViewWelcome.Root>
  );
}

function RecentFlowsSplash() {
  // Get the recent flows with the custom hook
  const [fetchingRecents, recentFlows, predefinedFlows] = useGetRecentFlows();

  return (
    <ScrollableViewWelcome.Root>
      <ScrollableViewWelcome.Header>
        <div className="text-xl font-semibold">
          {recentFlows.length === 0
            ? predefinedFlows.length === 0
              ? "Recent flows"
              : "Preset flows"
            : "Recent flows"}
        </div>
      </ScrollableViewWelcome.Header>
      <ScrollableViewWelcome.Body>
        {fetchingRecents ? (
          <div className="w-full h-full flex justify-center items-center">
            <RotatingLines />
          </div>
        ) : (
          <div className="w-full h-full">
            {recentFlows.length === 0 ? (
              predefinedFlows.length > 0 ? (
                <PredefinedFlows flows={predefinedFlows} />
              ) : (
                <div className="h-full w-[26rem] flex justify-center items-center">
                  No recent flows
                </div>
              )
            ) : (
              <RecentUserFlows flows={recentFlows} />
            )}
          </div>
        )}
      </ScrollableViewWelcome.Body>
      <ScrollableViewWelcome.Footer>
        <a
          className="app-button text-black text-decoration-none"
          href="https://horus.bsc.es/docs/running_flows/index.html"
          target="_blank"
        >
          Learn more about flows
        </a>
      </ScrollableViewWelcome.Footer>
    </ScrollableViewWelcome.Root>
  );
}

function ExploreExtensions() {
  const pages = usePluginPages();

  // Filter the pages to have at max 10
  const pagesToShow = pages.filter((page) => !page.hidden).slice(0, 10);

  const loadPage = (page: PluginPage) => {
    // Set the startWorking view
    const startWorkingEvent = new CustomEvent("start-working", {
      detail: <WorkingView extensionToOpen={page} />,
    });

    window.dispatchEvent(startWorkingEvent);
  };

  return (
    <ScrollableViewWelcome.Root>
      <ScrollableViewWelcome.Header>
        <div className="text-xl font-semibold">Extensions</div>
      </ScrollableViewWelcome.Header>
      <ScrollableViewWelcome.Body>
        <div className="w-full h-full">
          {pagesToShow.length === 0 ? (
            <div className="h-full w-[26rem] flex justify-center items-center">
              No extensions
            </div>
          ) : (
            <PluginPagesView pages={pagesToShow} overrideLoadPage={loadPage} />
          )}
        </div>
      </ScrollableViewWelcome.Body>
      <ScrollableViewWelcome.Footer>
        <a
          className="app-button text-black text-decoration-none"
          href="https://horus.bsc.es/docs/developer_guide/horusapi/extensions.html"
          target="_blank"
        >
          Learn more about extensions
        </a>
      </ScrollableViewWelcome.Footer>
    </ScrollableViewWelcome.Root>
  );
}

function ScrollableViewWelcomeRoot(props: { children: React.ReactNode }) {
  return (
    <HorusContainer className="flex flex-col justify-center items-center gap-2 w-fit">
      {props.children}
    </HorusContainer>
  );
}

function ScrollableViewWelcomeHeader(props: { children: React.ReactNode }) {
  return <>{props.children}</>;
}

function ScrollableViewWelcomeBody(props: {
  children: React.ReactNode;
  maxHeight?: string;
}) {
  return (
    <div
      className="overflow-y-auto scrollable-welcome"
      style={{
        width: "400px",
        maxHeight: props.maxHeight || "50vh",
      }}
    >
      {props.children}
    </div>
  );
}

function ScrollableViewWelcomeFooter(props: { children: React.ReactNode }) {
  return <>{props.children}</>;
}

const ScrollableViewWelcome = {
  Root: ScrollableViewWelcomeRoot,
  Header: ScrollableViewWelcomeHeader,
  Body: ScrollableViewWelcomeBody,
  Footer: ScrollableViewWelcomeFooter,
};
