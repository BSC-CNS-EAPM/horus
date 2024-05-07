// React
import { useEffect, useState } from "react";

// TS
import { GLOBAL_IDS } from "../../Utils/globals";

// Spinner
import RotatingLines from "../RotatingLines/rotatinglines";

type IFrameLoaderProps = {
  pagename: string;
  url: string;
  data: any;
};

function IFrameLoader({ url, pagename, data }: IFrameLoaderProps) {
  const fixedURL = () => {
    return url;
    let domain = window.location.href;

    // Remove the final slash
    if (domain.endsWith("/")) {
      domain = domain.slice(0, -1);
    }

    return domain + url;
  };

  const [loading, setLoading] = useState(true);

  const handleLoad = () => {
    setLoading(false);
  };

  useEffect(() => {
    window.extensionData = data;

    const iframe = document.getElementById(
      GLOBAL_IDS.EXTENSIONS_IFRAME
    ) as HTMLIFrameElement;
    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [url, pagename, data]);

  return (
    <div id="iframe-loader" className="h-full w-full p-0 m-0">
      {loading && (
        <div className="flex flex-col items-center justify-center h-full">
          <RotatingLines size={"100px"} />
          Loading {pagename}
        </div>
      )}
      <iframe
        // id={`${url}-${pagename}`}
        id={GLOBAL_IDS.EXTENSIONS_IFRAME}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation allow-downloads allow-modals allow-top-navigation"
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
