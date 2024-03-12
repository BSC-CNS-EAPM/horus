import { IconProps } from "./IconType";

export default function BackArrow(props: IconProps) {
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
        d="M7 19V17H14.1C15.15 17 16.0627 16.6667 16.838 16C17.6133 15.3333 18.0007 14.5 18 13.5C18 12.5 17.6127 11.6667 16.838 11C16.0633 10.3333 15.1507 10 14.1 10H7.8L10.4 12.6L9 14L4 9L9 4L10.4 5.4L7.8 8H14.1C15.7167 8 17.1043 8.525 18.263 9.575C19.4217 10.625 20.0007 11.9333 20 13.5C20 15.0667 19.421 16.375 18.263 17.425C17.105 18.475 15.7173 19 14.1 19H7Z"
        fill="currentColor"
      />
    </svg>
  );
}
