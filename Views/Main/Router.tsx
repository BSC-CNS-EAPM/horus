import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./app";
import SplashScreen from "../Components/MainApp/WelcomeScreen";
import { RouterError } from "../Error/ShemsuError";
import { HorusPanelView } from "@/Components/MainApp/PanelView";
import { Cookies } from "@/Cookies/cookies";

const router = createBrowserRouter([
  {
    path: `${window.__HORUS_ROOT__}/`,
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
      {
        path: "*",
        element: <RouterError />,
      },
    ],
  },
  {
    path: `${window.__HORUS_ROOT__}/privacy`,
    element: <Cookies />,
  },
]);

export function HorusRouter() {
  return <RouterProvider router={router} />;
}
