import { IconProps } from "./IconType";

export default function Chevron(
  props: IconProps & {
    direction?: "left" | "right" | "up" | "down";
  }
) {
  const rotation = {
    left: 90,
    right: 270,
    up: 0,
    down: 180
  }[props.direction || "left"];

  return (
    <svg
      className="w-6 h-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      {...props}
      style={{
        ...(props.style ?? {}),
        transform: `${props.style?.transform ?? ""} rotate(${rotation}deg)`
      }}
    >
      <path d="M16.59 8.59003L12 13.17L7.41 8.59003L6 10L12 16L18 10L16.59 8.59003Z" />
    </svg>
  );
}
