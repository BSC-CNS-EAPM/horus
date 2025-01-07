// React
import { useEffect, useRef, useState } from "react";

// TS
import { GLOBAL_IDS } from "../../Utils/globals";

// Spinner
import RotatingLines from "../RotatingLines/rotatinglines";
import { PluginPage } from "../FlowBuilder/flow.types";

function IFrameLoader({
  page,
  data,
  onFocus,
}: {
  page: PluginPage;
  data: any;
  onFocus?: () => void;
}) {
  const fixedURL = () => {
    // Do not fix the url for the development page
    if (page?.url?.startsWith("http")) {
      return page.url;
    }

    let domain = window.origin + window.__HORUS_ROOT__;

    // Remove the final slash
    if (domain.endsWith("/")) {
      domain = domain.slice(0, -1);
    }

    return domain + page.url;
  };

  const [loading, setLoading] = useState(true);

  const uniqueID = useRef(Math.random().toString(36).slice(2));
  const iframeID = `${GLOBAL_IDS.EXTENSIONS_IFRAME}-${uniqueID.current}`;

  useEffect(() => {
    window.extensionData = data;

    const handleLoad = () => {
      setLoading(false);
    };

    const iframe = document.getElementById(iframeID) as HTMLIFrameElement;

    if (!iframe) {
      return;
    }

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [page, data, iframeID]);

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
          Loading {page.name}
        </div>
      )}
      <iframe
        // id={`${url}-${pagename}`}
        id={iframeID}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-downloads allow-modals allow-top-navigation"
        // If the url does not start with the current domain, add It in order to prevent http / https errors
        // Prevent double backslashes //
        src={fixedURL()}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: loading ? "none" : "block",
        }}
      />
    </div>
  );
}

export default IFrameLoader;
