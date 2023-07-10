import { useEffect, useState } from "react";
import { RotatingLines } from "react-loader-spinner";

interface IFrameLoaderProps {
  pagename: string;
  url: string;
}

function IFrameLoader({ url, pagename }: IFrameLoaderProps) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const iframe = document.getElementById(
      `${url}-${pagename}`
    ) as HTMLIFrameElement;
    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
    };
  }, [url, pagename]);

  const handleLoad = () => {
    setLoading(false);
  };

  return (
    <>
      {loading && (
        <div className="flex flex-col items-center justify-center h-full">
          <RotatingLines strokeColor="grey" />
          Loading {pagename}
        </div>
      )}
      <iframe
        id={`${url}-${pagename}`}
        src={url}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: loading ? "none" : "block",
        }}
      />
    </>
  );
}

export default IFrameLoader;
