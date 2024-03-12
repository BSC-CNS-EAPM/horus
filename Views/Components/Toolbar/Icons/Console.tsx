import { IconProps } from "./IconType";

export default function ConsoleIcon(props: IconProps) {
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
        d="M2 20V4H22V20H2ZM4 18H20V8H4V18ZM7.5 17L6.1 15.6L8.675 13L6.075 10.4L7.5 9L11.5 13L7.5 17ZM12 17V15H18V17H12Z"
        fill="currentColor"
      />
    </svg>
  );
}
