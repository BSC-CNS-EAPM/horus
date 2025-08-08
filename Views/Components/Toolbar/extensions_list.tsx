// React
import { useContext, useEffect, useState } from "react";

// Horus web-server
import { socket } from "../../Utils/socket";
import { horusGet } from "../../Utils/utils";

// Horus imports
import { PluginPage } from "../FlowBuilder/flow.types";
import { BreakLongUnderscoreNames } from "../FlowBuilder/Blocks/block.view";
import Chevron from "./Icons/Chevron";
import { addPanel, DockContext, PANEL_REGISTRY } from "../MainApp/PanelView";

type PluginPageViewProps = {
  pages: Array<PluginPage>;
  overrideLoadPage?: (page: PluginPage) => void;
};

export default function PluginPagesView(props: PluginPageViewProps) {
  const { pages } = props;

  const { dockApi } = useContext(DockContext);

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1">
      {pages
        ?.filter((page) => !page.hidden)
        .map((page) => (
          <div
            key={page.id}
            role="button"
            onClick={() => {
              if (props.overrideLoadPage) {
                props.overrideLoadPage(page);
              } else {
                if (dockApi) {
                  addPanel({
                    dockApi: dockApi,
                    component: PANEL_REGISTRY.extensions.component,
                    panelID: `extensions-${page.id}-${Math.floor(
                      Math.random() * 100000
                    )}`,
                    params: page,
                  });
                }
              }
            }}
            className="predefined-flow gap-2 flex items-center flex-row flex-nowrap"
          >
            {page.logo ? (
              <img src={page.logo} alt={page.name} className="w-8 h-8" />
            ) : (
              <Chevron
                direction="right"
                className="w-8 h-8"
                color="black"
                style={{
                  transform: "translateX(-2px)",
                }}
              />
            )}
            <div key={page.id}>
              <div className="predefined-flow-name max-w-[350px] cut-text">
                <BreakLongUnderscoreNames name={page.name} />
              </div>
              <div className="predefined-flow-plugin max-w-[350px] cut-text">
                <BreakLongUnderscoreNames
                  name={page.description ?? "Extension"}
                />{" "}
                - {page.plugin ?? "Unknown"}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

export function usePluginPages() {
  const [pluginPages, setPluginPages] = useState<PluginPage[]>([]);

  const getPluginPages = async () => {
    const response = await horusGet("/api/plugins/listpages");

    if (!response) {
      return;
    }

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const pagesData: [PluginPage] = data.pages;

    // Skip hidden pages
    const filteredPages = pagesData.filter((page) => !page.hidden);

    // Order the pages alphabetically
    filteredPages.sort((a, b) => a.name.localeCompare(b.name));

    setPluginPages(filteredPages);
  };

  useEffect(() => {
    // Fetch the pages from the server api
    getPluginPages();

    // Add a scoket listener to update the extensions list after a plugin is installed/uninstalled
    socket.on("pluginChanges", getPluginPages);

    // Create an event listener for when changing the setting of the Development page
    // to reload the pages
    window.addEventListener("settingsChanged", getPluginPages);

    return () => {
      socket.off("pluginChanges", getPluginPages);
      window.removeEventListener("settingsChanged", getPluginPages);
    };
  }, []);

  return pluginPages;
}
