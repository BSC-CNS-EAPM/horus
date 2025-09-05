// Import the css file
import { forwardRef } from "react";
import "./horus_container.css";

type HorusContainerProps = React.HTMLProps<HTMLDivElement>;

const HorusContainer = forwardRef(_HorusContainer);

export default HorusContainer;

function _HorusContainer(props: HorusContainerProps, ref: any) {
  return (
    <div
      {...props}
      ref={ref}
      style={{
        cursor: props.onClick ? "pointer" : "auto",
        ...props.style
      }}
      className={`${props.className} horus-container animated-gradient`}
    >
      {props.children}
    </div>
  );
}
