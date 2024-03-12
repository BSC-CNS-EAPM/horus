import { IconProps } from "./IconType";

export default function CreateFolderIcon(props: IconProps) {
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
        d="M2 20V4H10L12 6H22V20H2ZM4 18H20V8H11.175L9.175 6H4V18ZM14 16H16V14H18V12H16V10H14V12H12V14H14V16Z"
        fill="currentColor"
      />
    </svg>
  );
}
