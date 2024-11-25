import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./app";
import SplashScreen from "../Components/MainApp/WelcomeScreen";
import { RouterError } from "../Error/ShemsuError";
import { HorusPanelView } from "@/Components/MainApp/PanelView";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    errorElement: <RouterError />,
    children: [
      {
        path: "",
        element: <SplashScreen />,
      },
      {
        path: "flow",
        element: <HorusPanelView />,
      },
    ],
  },
]);

export function HorusRouter() {
  return <RouterProvider router={router} />;
}
