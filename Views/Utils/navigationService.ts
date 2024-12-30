// navigationService.ts
import { NavigateFunction } from "react-router-dom";

let navigateFn: NavigateFunction | null = null;

// Set up the navigate function with type safety
export const setNavigate = (navigate: NavigateFunction) => {
  navigateFn = navigate;
};

// Function to navigate from outside React components
export const navigateTo = (path: string) => {
  if (navigateFn) {
    navigateFn(path); // Uses React Router's navigate function
  } else {
    console.error("Navigate function is not initialized");
  }
};
