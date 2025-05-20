// Create the main window view
import { createRoot } from "react-dom/client";

// Polyfills
import "core-js/stable";
import "regenerator-runtime/runtime";

// Import CSS
import "../CSS/main.css";
import { StrictMode } from "react";
import { HorusRouter } from "./Router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OverrideAlert } from "./OverrideAlert";

let container: HTMLElement | null = null;
export const queryClient = new QueryClient();

document.addEventListener("DOMContentLoaded", () => {
  if (!container) {
    // check if createRoot has already been called
    container = document.getElementById("horusRoot")!;
    const root = createRoot(container);
    root.render(
      // StrictMode is not compatible with XArrows, disable in production, enable in debug
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <OverrideAlert>
            <HorusRouter />
          </OverrideAlert>
        </QueryClientProvider>
      </StrictMode>,
    );
  }
});
