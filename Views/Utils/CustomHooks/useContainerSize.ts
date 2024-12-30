import useResizeObserver from "@react-hook/resize-observer";
import { useState } from "react";

export function useContainerSize(containerRef: HTMLDivElement | null) {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useResizeObserver(containerRef?.parentElement ?? null, () => {
    if (!containerRef) {
      return;
    }

    setWidth(containerRef.parentElement?.offsetWidth ?? 0);
    setHeight(containerRef.parentElement?.offsetHeight ?? 0);
  });

  return {
    width,
    height,
  };
}
