// Import the image
// @ts-ignore
import { useRouteError } from "react-router";
import horus_god from "@resources/horus_god.png";

// Import the css file
import "./error.css";
import AppButton from "../Components/appbutton";
import { Link } from "react-router-dom";

export function RouterError() {
  const routeError: any = useRouteError();

  return (
    <div className="grid place-items-center w-full mt-12">
      <Error error={routeError}>
        <Link to="/">
          <AppButton>Go Home</AppButton>
        </Link>
      </Error>
    </div>
  );
}

// Create a component for the error window
export function Error({
  error,
  children,
}: {
  error?: any;
  children?: React.ReactNode;
}) {
  const getErrorMessage = () => {
    if (error?.message) {
      return error.message;
    }

    if (error?.statusText) {
      return error.statusText;
    }

    if (typeof error === "string") {
      return error;
    }

    return "Unknown error.";
  };

  return (
    <div className="m-auto h-full gap-2 grid place-items-center max-w-[500px] mx-4">
      <div className="flex flex-col gap-2 justify-start items-start">
        <h1 className="text-[60px] font-bold text-red-500 text-start">ERROR</h1>
        <p className="text-start">
          Something went wrong. Please refresh the page or go back.
        </p>
        <p
          className="font-bold text-start"
          style={{
            textAlign: "left",
          }}
        >
          {window.flaskError ? window.flaskError : getErrorMessage()}
        </p>
        {children}
      </div>
      <img src={horus_god} alt="Shemsu Error" className="shemsu-img" />
    </div>
  );
}
