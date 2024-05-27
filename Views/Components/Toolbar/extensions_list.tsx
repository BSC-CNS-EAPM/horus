// React
import { useEffect, useState } from "react";

// Horus web-server
import { socket } from "../../Utils/socket";
import { horusGet } from "../../Utils/utils";

// Horus imports
import { PluginPage } from "../FlowBuilder/flow.types";

export const loadPage = async (page?: PluginPage, blockIDCustom?: number) => {
  // Emit an event to the iframe
  const event = new CustomEvent("loadExtension", {
    detail: { page: page, blockIDCustom: blockIDCustom },
  });
  window.dispatchEvent(event);
};

type PluginPageViewProps = {
  pages: Array<PluginPage>;
  overrideLoadPage?: (page: PluginPage) => void;
};

export default function PluginPagesView(props: PluginPageViewProps) {
  const { pages } = props;

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
            onClick={() => {
              if (props.overrideLoadPage) {
                props.overrideLoadPage(page);
              } else {
                loadPage(page);
              }
            }}
            className="predefined-flow"
          >
            <div className="predefined-flow-name">{page.name}</div>
            <div className="predefined-flow-plugin">{page.description}</div>
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

    return () => {
      socket.off("pluginChanges", getPluginPages);
    };
  }, []);

  return pluginPages;
}
