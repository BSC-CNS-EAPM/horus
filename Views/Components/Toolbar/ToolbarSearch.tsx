import { useEffect, useState } from "react";
import { Flow, PluginPage } from "../FlowBuilder/flow.types";
import RecentUserFlows, {
  PredefinedFlows,
  useGetRecentFlows,
} from "../FlowStatus/recent_flows";
import RotatingLines from "../RotatingLines/rotatinglines";
import { SearchComponent } from "../Search/Search";
import PluginPagesView from "./extensions_list";
import { HorusLink } from "../reusable";

export function HorusSearch({ pages }: { pages: PluginPage[] }) {
  const [predefinedFilteredFlows, setPredefinedFilteredFlows] = useState<
    Flow[]
  >([]);
  const [recentFilteredFlows, setRecentFilteredFlows] = useState<Flow[]>([]);

  const [filteredTemplates, setFilteredTemplates] = useState<Flow[]>([]);

  const [filteredPages, setFilteredPages] = useState<PluginPage[]>(pages);

  const [filterTerm, setFilterTerm] = useState("");

  const webAppMode = window.horusInternal.mode === "webapp";

  // Get the recent flows with the custom hook
  const {
    isLoading: fetchingRecents,
    recentFlows,
    presetFlows: predefinedFlows,
    templates,
  } = useGetRecentFlows(webAppMode);

  useEffect(() => {
    const value = filterTerm;

    if (value === "" || value === undefined) {
      setPredefinedFilteredFlows(predefinedFlows);
      setRecentFilteredFlows(recentFlows);
      setFilteredTemplates(templates);
      setFilteredPages(pages);
      return;
    }

    const filteredFlows = predefinedFlows.filter((flow) => {
      return (
        flow.name.toLowerCase().includes(value.toLowerCase()) ||
        (flow.pluginName ?? "Unnamed plugin")
          .toLowerCase()
          .includes(value.toLowerCase())
      );
    });

    setPredefinedFilteredFlows(filteredFlows);

    const filteredRecentFlows = recentFlows.filter((flow) => {
      return (
        flow.name.toLowerCase().includes(value.toLowerCase()) ||
        (flow.path ?? "Unknown path")
          .toLowerCase()
          .includes(value.toLowerCase())
      );
    });

    setRecentFilteredFlows(filteredRecentFlows);

    const filteredTemp = templates.filter((flow) => {
      return flow.name.toLowerCase().includes(value.toLowerCase());
    });

    setFilteredTemplates(filteredTemp);

    const filteredPages: PluginPage[] = pages.filter((page: PluginPage) => {
      return (
        page.name.toLowerCase().includes(value.toLowerCase()) ||
        page.description?.toLowerCase().includes(value.toLowerCase()) ||
        page.plugin?.toLowerCase().includes(value.toLowerCase())
      );
    });

    setFilteredPages(filteredPages);
  }, [filterTerm, predefinedFlows, recentFlows, templates, pages]);

  const [isOnFocus, setIsOnFocus] = useState(false);

  const hasFlows =
    recentFilteredFlows.length > 0 || predefinedFilteredFlows.length > 0;

  function RecentFlowsView() {
    return (
      <>
        {fetchingRecents ? (
          <div className="flex flex-col justify-center items-center text-center">
            <RotatingLines size={"2rem"} />
            <div>Loading recent flows...</div>
          </div>
        ) : (
          <RecentUserFlows flows={recentFilteredFlows} />
        )}
      </>
    );
  }

  function TemplatesView() {
    const getURL = (flow: Flow) => {
      const open = window.location.search.includes("open=true")
        ? "yes"
        : "true";
      return `/flow?open=${open}&flowID=${flow.savedID}&template=true`;
    };

    return (
      <div className="flex flex-col gap-1">
        {filteredTemplates?.map((flow) => (
          <HorusLink
            to={getURL(flow)}
            key={flow.savedID}
            className="predefined-flow"
          >
            <div className="predefined-flow-name">{flow.name}</div>
            <div className="predefined-flow-plugin">Template</div>
          </HorusLink>
        ))}
      </div>
    );
  }

  const hasContent =
    recentFilteredFlows.length > 0 ||
    predefinedFilteredFlows.length > 0 ||
    filteredPages.length > 0 ||
    filteredTemplates.length > 0;

  return (
    <div
      className="h-full overflow-y-auto"
      onFocus={() => {
        setIsOnFocus(true);
      }}
      onBlur={() => {
        setTimeout(() => {
          setIsOnFocus(false);
        }, 100);
      }}
    >
      <SearchComponent
        placeholder="Search Horus..."
        onChange={(e) => {
          setFilterTerm(e.target.value);
        }}
      />
      {isOnFocus && (
        <div
          className="flex flex-col gap-2 absolute p-2 mt-3 origin-top-right rounded-xl bg-white toolbar-menu overflow-y-auto zoom-out-animation"
          style={{
            right: 4,
            maxHeight: "calc(100vh - 4rem)",
          }}
        >
          {!hasContent && (
            <div className="predefined-flow text-center">Nothing found...</div>
          )}
          {hasFlows && (
            <div className="plugin-variable">
              <div className="predefined-flow-name font-semibold">
                Recent flows
              </div>
              <RecentFlowsView />
            </div>
          )}
          {predefinedFilteredFlows.length > 0 && (
            <div className="plugin-variable">
              <div className="predefined-flow-name font-semibold">
                Preset flows
              </div>
              <PredefinedFlows flows={predefinedFilteredFlows} />
            </div>
          )}
          {filteredTemplates.length > 0 && (
            <div className="plugin-variable">
              <div className="predefined-flow-name font-semibold">
                Templates
              </div>
              <TemplatesView />
            </div>
          )}
          {filteredPages.length > 0 && (
            <div className="plugin-variable">
              <div className="predefined-flow-name font-semibold">
                Extensions
              </div>
              <PluginPagesView pages={filteredPages} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
