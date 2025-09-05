import { useContext, useEffect, useRef, useState } from "react";
import { GLOBAL_IDS } from "../../Utils/globals";
import RotatingLines from "../RotatingLines/rotatinglines";
import { PluginPage, PluginVariable } from "../FlowBuilder/flow.types";
import { FlowBuilderContext } from "../MainApp/PanelView";
import AppButton from "../appbutton";
import { DockviewPanelApi } from "dockview-react";
import { FlowBuilderHooks } from "../FlowBuilder/flow.hooks";

export const DEVELOPMENT_EXTENSION_ID = `${GLOBAL_IDS.EXTENSIONS_IFRAME}-development`;

export function getIframeExtensionID(page: PluginPage) {
  const uniqueID = Math.random().toString(36).slice(2);

  if (page.placedID) {
    if (page.variable_id) {
      return `${GLOBAL_IDS.EXTENSIONS_IFRAME}-${page.placedID}-${page.variable_id}`;
    }
    if (page.dataID) {
      return `${GLOBAL_IDS.EXTENSIONS_IFRAME}-${page.placedID}-${uniqueID}-${page.dataID}`;
    }
  }

  if (page.developmentPage) {
    return `${DEVELOPMENT_EXTENSION_ID}-${uniqueID}`;
  }

  if (!page.placedID) {
    return `${GLOBAL_IDS.EXTENSIONS_IFRAME}-${uniqueID}-${page.id}`;
  }

  return `${GLOBAL_IDS.EXTENSIONS_IFRAME}-${page.placedID}-${page.id}`;
}

function findCustomVars(flowBuilderContext?: FlowBuilderHooks | null) {
  const blocks = flowBuilderContext?.flow?.flow.blocks ?? [];
  return blocks.flatMap((b) =>
    b.variables.filter((v) => !!(v as any).customPage)
  );
}

function updateDevelopmentIframes(
  panelApi: DockviewPanelApi,
  customVar: PluginVariable,
  iframeID: string,
  flowBuilderContext?: FlowBuilderHooks | null
) {
  if (!flowBuilderContext) return;

  // Avoid duplicates
  flowBuilderContext.misc.setDevelopmentIframes((prev) => {
    const exists = prev.some(
      (d) =>
        d.iframe_id === iframeID &&
        d.variable_id === customVar.id &&
        d.panel_id === panelApi.id
    );

    if (exists) return prev;

    // Inject the first time to the iframe the custom variable
    const iframe = document.getElementById(iframeID) as HTMLIFrameElement;
    if (iframe?.contentWindow) {
      // Find the variable
      const variable = flowBuilderContext.flow.flow.blocks
        .find((b) => b.placedID === customVar.placedID)
        ?.variables.find((v) => v.id === customVar.id);

      // This is temporary, as soon as the iframe loads for the first time,
      // the custom variable will take over
      // injecting the correct onchange handler
      iframe.contentWindow.horusVariable = {
        getVariable: () => variable,
        setVariable: (value: any) => {
          if (variable) {
            variable.value = value;
          }
        }
      };
    }

    return [
      ...prev,
      {
        iframe_id: iframeID,
        variable_id: customVar.id,
        variable_placedID: customVar.placedID,
        panel_id: panelApi.id
      }
    ];
  });

  // Set placedID in panel params for downstream logic
  if (customVar.placedID) {
    panelApi.updateParameters({
      placedID: customVar.placedID
    });
  }
}

function IFrameLoader({
  page,
  data,
  panelApi,
  onFocus,
  onLoad
}: {
  page: PluginPage;
  data: any;
  panelApi: DockviewPanelApi;
  onFocus?: () => void;
  onLoad?: () => void;
}) {
  const fixedURL = () => {
    // Do not fix the url for the development page
    // Plugins installed do not have a protocol, as will be inherited later
    // Plugins determine its url in the following form /plugins/pages/pluginid.pageid/
    if (page?.url?.startsWith("http")) {
      return page.url;
    }

    let domain = window.origin + window.__HORUS_ROOT__;

    // Remove the final slash for the doman, in order to no have multiple "//"
    if (domain.endsWith("/")) {
      domain = domain.slice(0, -1);
    }

    let url: null | string = page?.url ?? null;

    if (url) {
      url += page.path ?? "";
    }

    if (!url) {
      url = `/plugins/pages/${page.id}${page.path ?? ""}`;
    }

    // Always end the URL with a final slash,
    // this will prevent load balancers from mixing the content
    // and therefore the browser won't block the request. (Look at https://stackoverflow.com/a/58428968/15479705)
    // EXCEPT if the URL is for a documentation page and ends with .html
    if (!url.endsWith("/") && !url.endsWith(".html")) {
      url = url + "/";
    }

    return domain + url;
  };

  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const flowBuilderContext = useContext(FlowBuilderContext);
  const iframeIDRef = useRef<string>(getIframeExtensionID(page));
  const iframeID = iframeIDRef.current;
  const [selectedVarID, setSelectedVarID] = useState<{
    id: string;
    placedID: number;
  }>({ id: "", placedID: 0 });

  const handleSelectVar = () => {
    const customVars = findCustomVars(flowBuilderContext);
    const selectedVar = customVars.find(
      (v) => v.id === selectedVarID.id && v.placedID === selectedVarID.placedID
    );
    if (selectedVar) {
      updateDevelopmentIframes(
        panelApi,
        selectedVar,
        iframeID,
        flowBuilderContext
      );
      hasSelectedVarRef.current = true;
    }
    setShowModal(false);
  };

  const hasSelectedVarRef = useRef(false);

  useEffect(() => {
    const iframe = document.getElementById(
      iframeID
    ) as HTMLIFrameElement | null;

    if (!iframe) {
      return;
    }

    const handleLoad = () => {
      if (!iframe?.contentWindow) return;

      iframe.contentWindow.extensionData = data;
      iframe.contentWindow.horus = window.horus;
      iframe.contentWindow.molstar = window.molstar;

      iframe.contentWindow.horus.setTabTitle = (title: string) => {
        panelApi?.setTitle?.(title);
      };
      iframe.contentWindow.horus.closeTab = () => {
        panelApi?.close?.();
      };

      if (page.developmentPage && !hasSelectedVarRef.current) {
        const customVars = findCustomVars(flowBuilderContext);

        if (customVars.length > 1) {
          setShowModal(true);
        } else if (customVars.length === 1 && customVars[0]?.id) {
          updateDevelopmentIframes(
            panelApi,
            customVars[0],
            iframeID,
            flowBuilderContext
          );
          hasSelectedVarRef.current = true;
        }
      }

      setLoading(false);
      onLoad?.();
    };

    // Handle load before the iframe has loaded to inject the variables
    handleLoad();

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [page, data, iframeID, onLoad, flowBuilderContext, panelApi]);

  return (
    <div
      id="iframe-loader"
      className="h-full w-full p-0 m-0"
      onMouseEnter={onFocus}
    >
      {loading && (
        <div className="flex flex-col items-center justify-center h-full">
          {page.logo && <img src={page.logo} className="w-36" />}
          <RotatingLines size={"100px"} />
          <span className="mt-4 text-lg font-medium text-gray-600">
            Loading {page.name}
          </span>
        </div>
      )}

      {showModal &&
        (() => {
          const customVars = findCustomVars(flowBuilderContext);

          if (customVars.length && !selectedVarID.id) {
            setSelectedVarID({
              id: customVars[0]!.id,
              placedID: customVars[0]!.placedID
            });
          }

          return (
            <div
              className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center"
              style={{
                zIndex: 10000
              }}
            >
              <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
                <h2 className="text-2xl font-semibold text-gray-800">
                  Development Extension
                </h2>
                <p className="text-gray-600">Select the Custom Variable:</p>

                <select
                  className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={JSON.stringify(selectedVarID)}
                  onChange={(e) => {
                    if (e.target.value) {
                      const { id, placedID } = JSON.parse(e.target.value);
                      setSelectedVarID({ id, placedID });
                    }
                  }}
                >
                  <option value="" disabled>
                    Select a variable
                  </option>
                  {customVars.map((v) => {
                    const key = `${v.id} ${v.placedID}`;
                    return (
                      <option
                        key={key}
                        value={JSON.stringify({
                          id: v.id,
                          placedID: v.placedID
                        })}
                      >
                        {key}
                      </option>
                    );
                  })}
                </select>

                <div className="flex justify-end gap-2">
                  <AppButton action={() => setShowModal(false)}>
                    Cancel
                  </AppButton>
                  <AppButton action={handleSelectVar} disabled={!selectedVarID}>
                    Confirm
                  </AppButton>
                </div>
              </div>
            </div>
          );
        })()}

      <iframe
        onLoad={() => setLoading(false)}
        id={iframeID}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals allow-top-navigation"
        src={fixedURL()}
        className={`w-full h-full border-0 ${loading ? "hidden" : "block"}`}
      />
    </div>
  );
}

export default IFrameLoader;
