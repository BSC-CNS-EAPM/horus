import { IconProps } from "./IconType";

export default function NewFlowIcon(props: IconProps) {
  return (
    <svg
      className="w-6 h-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={0}
      stroke="currentColor"
      {...props}
    >
      <path
        d="M3 21V3H11V5H5V19H19V13H21V21H3ZM16 11V8H13V6H16V3H18V6H21V8H18V11H16Z"
        fill="currentColor"
      />
    </svg>
  );
}
