// React
import { useEffect, useState } from "react";

// Horus web-server
import { socket } from "../../Utils/socket";
import { horusGet } from "../../Utils/utils";

// Horus imports
import { PluginPage } from "../FlowBuilder/flow.types";

export const loadPage = async (
  url?: string,
  pagename?: string,
  blockIDCustom?: number
) => {
  // Emit an event to the iframe
  const event = new CustomEvent("loadExtension", {
    detail: { url, pagename, blockIDCustom },
  });
  window.dispatchEvent(event);
};

type PluginPageViewProps = {
  pages: Array<PluginPage>;
  overrideLoadPage?: (url: string, pagename: string) => void;
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
                props.overrideLoadPage(page.url, page.name);
              } else {
                loadPage(page.url, page.name);
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

    const data: [PluginPage] = await response.json();

    // Order the pages alphabetically
    data.sort((a, b) => a.name.localeCompare(b.name));

    setPluginPages(data);
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
