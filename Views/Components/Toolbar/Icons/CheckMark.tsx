import { IconProps } from "./IconType";

export default function CheckMark(props: IconProps) {
  return (
    <svg
      className="w-6 h-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1}
      stroke="currentColor"
      {...props}
    >
      <path d="M10 16.17L5.83 12L4.41 13.41L10 19L22 7.00003L20.59 5.59003L10 16.17Z" />
    </svg>
  );
}
