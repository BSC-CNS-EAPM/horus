import { ReactNode } from "react";

export function GreenOverlay({ children }: { children: ReactNode }) {
  return (
    <div
      className="backdrop-blur-sm bg-green-200 bg-opacity-50 m-auto cursor-copy w-full h-full"
      style={{
        placeContent: "center",
        display: "grid",
        position: "absolute",
        zIndex: 100,
        cursor: "copy !important",
      }}
    >
      {children}
    </div>
  );
}
