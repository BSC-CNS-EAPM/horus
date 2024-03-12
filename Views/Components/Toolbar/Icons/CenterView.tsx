import { IconProps } from "./IconType";

export default function CenterView(props: IconProps) {
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
        d="M7 17V7H17V17H7ZM9 15H15V9H9V15ZM7 21V19H9V21H7ZM3 5V3H5V5H3ZM7 5V3H9V5H7ZM11 21V19H13V21H11ZM11 5V3H13V5H11ZM15 5V3H17V5H15ZM15 21V19H17V21H15ZM19 5V3H21V5H19ZM3 21V19H5V21H3ZM3 17V15H5V17H3ZM3 13V11H5V13H3ZM3 9V7H5V9H3ZM19 21V19H21V21H19ZM19 17V15H21V17H19ZM19 13V11H21V13H19ZM19 9V7H21V9H19Z"
        fill="currentColor"
      />
    </svg>
  );
}
