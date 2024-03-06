import { IconProps } from "./IconType";

export default function ChronoIcon(props: IconProps) {
  return (
    <svg
      className="w-6 h-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="#currentColor"
      viewBox="0 0 24 24"
      strokeWidth={0}
      stroke="currentColor"
      {...props}
    >
      <path
        d="M13 1.01001H7V3.01001H13V1.01001ZM9 14.01H11V8.01001H9V14.01ZM17.03 7.39001L18.45 5.97001C18.02 5.46001 17.55 4.98001 17.04 4.56001L15.62 5.98001C14.07 4.74001 12.12 4.00001 10 4.00001C5.03 4.00001 1 8.03001 1 13C1 17.97 5.02 22 10 22C14.98 22 19 17.97 19 13C19 10.89 18.26 8.94001 17.03 7.39001ZM10 20.01C6.13 20.01 3 16.88 3 13.01C3 9.14001 6.13 6.01001 10 6.01001C13.87 6.01001 17 9.14001 17 13.01C17 16.88 13.87 20.01 10 20.01Z"
        fill="currentColor"
      />
    </svg>
  );
}
