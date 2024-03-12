import { IconProps } from "./IconType";

export default function SaveIcon(props: IconProps) {
  return (
    <svg
      className="w-6 h-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={0}
      stroke="currentColor"
      {...props}
    >
      <path d="M3 20V2H12L18 8V11.025H16V9H11V4H5V18H11V20H3Z" />
      <path d="M17 23.975L21 19.975L19.6 18.575L18 20.175V14H16V20.175L14.4 18.575L13 19.975L17 23.975Z" />
    </svg>
  );
}
