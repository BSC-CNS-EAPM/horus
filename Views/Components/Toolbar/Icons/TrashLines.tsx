import { IconProps } from "./IconType";

export default function TrashLines(props: IconProps) {
  return (
    <svg
      className="w-6 h-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={1}
      stroke="none"
      {...props}
    >
      <path
        d="M15 18V16H19V18H15ZM15 10V8H22V10H15ZM15 14V12H21V14H15ZM3 8H2V6H6V4.5H10V6H14V8H13V17C13 17.55 12.8043 18.021 12.413 18.413C12.0217 18.805 11.5507 19.0007 11 19H5C4.45 19 3.97933 18.8043 3.588 18.413C3.19667 18.0217 3.00067 17.5507 3 17V8ZM5 8V17H11V8H5Z"
        fill="currentColor"
      />
    </svg>
  );
}
