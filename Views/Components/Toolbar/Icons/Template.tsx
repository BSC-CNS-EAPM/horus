import { IconProps } from "./IconType";

export default function TemplateIcon(props: IconProps) {
  return (
    <svg
      className="w-6 h-6"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      viewBox="0 0 16 24"
      strokeWidth={0}
      stroke="currentColor"
      {...props}
    >
      <path d="M10 20V16.925L16.575 10.375L19.65 13.425L13.075 20H10ZM11.5 18.5H12.45L15.475 15.45L15.025 14.975L14.55 14.525L11.5 17.55V18.5ZM0 20V0H10L16 6V9H14V7H9V2H2V18H8V20H0ZM15.025 14.975L14.55 14.525L15.475 15.45L15.025 14.975Z" />
    </svg>
  );
}
