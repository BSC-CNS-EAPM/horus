// React
import { useRef } from "react";

// Import the css file
import "./horus_container.css";

type HorusContainerProps = React.HTMLProps<HTMLDivElement>;

export default function HorusContainer(props: HorusContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      {...props}
      ref={containerRef}
      className={`${props.className} horus-container animated-gradient`}
    >
      {props.children}
    </div>
  );
}
