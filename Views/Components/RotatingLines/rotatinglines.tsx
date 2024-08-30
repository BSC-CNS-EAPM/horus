// @ts-ignore
// import rotatinglines from "./rotating.gif";

// Pulsating circle
import { useEffect, useRef } from "react";
import "./rotating.css";

export default function RotatingLines(
  props: React.HTMLAttributes<HTMLDivElement> & {
    size?: number | string;
  }
) {
  const loaderRef = useRef<HTMLDivElement>(null);

  loaderRef.current?.style.setProperty(
    "--size",
    props.size ? `${props.size}` : "50px"
  );

  useEffect(() => {
    loaderRef.current?.style.setProperty(
      "--size",
      props.size ? `${props.size}` : "50px"
    );
  }, [props.size]);

  return (
    <div {...props}>
      <div ref={loaderRef} className="loader" />
    </div>
  );
}
