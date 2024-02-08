import { IconProps } from "./IconType";

export default function BackArrowIcon(props: IconProps) {
  return (
    <svg
      className="w-6 h-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="#585D61"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="#585D61"
      {...props}
    >
      <path d="M17 4.60909L15.4747 3L7 12L15.4833 21L17 19.3909L10.0334 12L17 4.60909Z" />
    </svg>
  );
}
