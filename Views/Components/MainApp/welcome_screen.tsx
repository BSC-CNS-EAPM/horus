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
import { HorusModal } from "../reusable";

// Icons
import NewFlowIcon from "../Toolbar/Icons/New";
import PluginsIcon from "../Toolbar/Icons/Plugins";
import SettingsIcon from "../Toolbar/Icons/Settings";
import ServerIcon from "../Toolbar/Icons/Server";
import OpenFlowIcon from "../Toolbar/Icons/Open";

// Import the horus logo
import Logo from "../logo";
import { PluginManager } from "../../PluginsManager/plugin_manager";
import ConfigRemotes from "../../Remotes/remotes";
import { SettingsView } from "../../Settings/settings";
import Login from "../Toolbar/Icons/Login";
import UserIcon from "../Toolbar/Icons/User";
import Profile from "../../Login/profile";

type SplashModal = {
  header?: React.ReactNode;
  body: React.ReactNode;
  footer?: React.ReactNode;
};

export default function SplashScreen() {
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalContent, setModalContent] = useState<SplashModal | null>(null);

  const updateModalContent = (modal: SplashModal) => {
    setModalContent(modal);
    setShowModal(true);
  };

  return (
    <div className="flex flex-col justify-center items-center h-screen">
      <WelcomeToHorus setModalContent={updateModalContent} />
      <div className="splash-container flex flex-row flex-wrap justify-center items-center w-full gap-8 zoom-in-animation overflow-auto text-white m-auto">
        <div className="flex gap-2 p-2 flex-wrap justify-center flex-direction-splash-buttons">
          <CreateNewFlow />
          <OpenFlow />
          {!window.horusInternal.webApp && (
            <ManagePlugins setModalContent={updateModalContent} />
          )}
          {window.horusInternal.webApp?.allowRemotes !== false && (
            <ManageRemotes setModalContent={updateModalContent} />
          )}
          <Settings setModalContent={updateModalContent} />
        </div>
        <div className="vertical-splash-separator" />
        <div className="flex flex-row flex-wrap gap-2 justify-center">
          <RecentFlowsSplash />
          <ExploreExtensions />
        </div>
        {modalContent && (
          <ModalView
            modal={modalContent}
            isOpen={showModal}
            onHide={() => setShowModal(false)}
          />
        )}
      </div>
    </div>
  );
}

function ModalView(props: {
  modal: SplashModal;
  isOpen: boolean;
  onHide: () => void;
}) {
  return (
    <HorusModal
      show={props.isOpen}
      header={props.modal.header}
      footer={props.modal.footer}
      onHide={props.onHide}
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
      className="flex flex-row items-center px-2 w-full"
      style={{
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
      <div className="flex justify-center items-center w-full font-semibold">
        Welcome to {appName}
      </div>
      {loginRequried && (
        <div className="flex flex-row gap-2">
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
  setModalContent: (modal: SplashModal) => void;
};

function ManagePlugins(props: ButtonOpensModalProps) {
  const setModalContent = () => {
    const footer = (
      <a
        className="app-button text-black text-decoration-none"
        href="https://nbdsoftware.github.io/horus/developer_guide/horusapi/plugins.html"
        target="_blank"
      >
        Learn more about plugins
      </a>
    );

    const body = <PluginManager />;

    props.setModalContent({
      body: body,
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
function Settings(props: ButtonOpensModalProps) {
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

function RecentFlowsSplash() {
  // Get the recent flows with the custom hook
  const [fetchingRecents, recentFlows, predefinedFlows, getFlows] =
    useGetRecentFlows();

  // Get the flows
  useEffect(() => {
    getFlows();
  }, []);

  return (
    <ScrollableViewWelcome.Root>
      <ScrollableViewWelcome.Header>
        <div className="text-xl font-semibold">
          {recentFlows.length === 0
            ? predefinedFlows.length === 0
              ? "Recent flows"
              : "Sample flows"
            : "Recent flows"}
        </div>
      </ScrollableViewWelcome.Header>
      <ScrollableViewWelcome.Body>
        {fetchingRecents ? (
          <div className="w-[26rem] h-full flex justify-center items-center">
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
          href="https://nbdsoftware.github.io/horus/running_flows/index.html"
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

  const loadPage = (url: string, name: string) => {
    // Set the startWorking view
    const startWorkingEvent = new CustomEvent("start-working", {
      detail: (
        <WorkingView
          extensionToOpen={{
            url,
            name,
          }}
        />
      ),
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
          href="https://nbdsoftware.github.io/horus/developer_guide/horusapi/extensions.html"
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
      className="overflow-y-scroll scrollable-welcome"
      style={{
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
