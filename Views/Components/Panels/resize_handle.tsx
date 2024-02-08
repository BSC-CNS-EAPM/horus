// Imports
import { PanelResizeHandle } from "react-resizable-panels";

// Resize handle. This is the little bar that you can drag to resize the panels.
export default function ResizeHandle({
  horizontal = false,
  onDragging,
  className,
}: {
  horizontal?: boolean;
  onDragging?: (e: boolean) => void;
  className?: string;
}) {
  const horizontalIcon = horizontal ? "Icon Icon-horizontal" : "Icon";

  const iframePointer = (e: any) => {
    if (e) {
      const iframe = document.getElementById("iframe-loader");
      if (iframe) {
        iframe.style.pointerEvents = "none";
      }
    } else {
      const iframe = document.getElementById("iframe-loader");
      if (iframe) {
        iframe.style.pointerEvents = "auto";
      }
    }
  };

  const handleOnDragging = (e: any) => {
    iframePointer(e);
    if (onDragging) {
      onDragging(e);
    }
  };

  return (
    <PanelResizeHandle
      className={`ResizeHandleOuter ${className}`}
      onDragging={handleOnDragging}
    >
      <div
        className={`ResizeHandleInner ${
          horizontal
            ? "ResizeHandleOuter--horizontal"
            : "ResizeHandleOuter--vertical"
        }`}
      >
        <svg className={horizontalIcon} viewBox="0 0 24 24">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
          </svg>
        </svg>
      </div>
    </PanelResizeHandle>
  );
}
