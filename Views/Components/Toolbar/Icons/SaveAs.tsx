import { IconProps } from "./IconType";

export default function SaveAsIcon(props: IconProps) {
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
      <g clip-path="url(#clip0_360_6463)">
        <path
          d="M18 21L22 17L20.6 15.6L19 17.2V13.025H17V17.2L15.4 15.6L14 17L18 21ZM14 24V22H22V24H14ZM4 20V2H13L19 8V11.025H17V9H12V4H6V18H12V20H4Z"
          fill="currentColor"
        />
      </g>
      <defs>
        <clipPath id="clip0_360_6463">
          <rect width="24" height="24" fill="white" />
        </clipPath>
      </defs>
    </svg>
  );
}
