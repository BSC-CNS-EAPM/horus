import { useEffect, useState } from "react";
import RotatingLines from "../RotatingLines/rotatinglines";

declare global {
  interface Window {
    extensionData: any;
  }
}

interface IFrameLoaderProps {
  pagename: string;
  url: string;
  data: any;
}

function IFrameLoader({ url, pagename, data }: IFrameLoaderProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.extensionData = data;

    const iframe = document.getElementById(
      `${url}-${pagename}`
    ) as HTMLIFrameElement;
    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [url, pagename, data]);

  const handleLoad = () => {
    setLoading(false);
  };

  return (
    <div id="iframe-loader" className="h-full w-full p-0 m-0">
      {loading && (
        <div className="flex flex-col items-center justify-center h-full">
          <RotatingLines />
          Loading {pagename}
        </div>
      )}
      <iframe
        id={`${url}-${pagename}`}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation allow-downloads allow-modals allow-top-navigation"
        src={url}
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
