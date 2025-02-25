import { useCallback, useEffect, useRef, useState } from "react";

import "../Components/appbutton.css";

import { fetchDesktop, horusGet, horusPost } from "../Utils/utils";
import { PluginVariableView } from "../Components/FlowBuilder/Variables/variables";
import HorusSwitch from "../Components/Switch/switch";
import { PluginVariable } from "../Components/FlowBuilder/flow.types";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import Logo from "../Components/logo";

// Captcha
import {
  loadCaptchaEnginge,
  LoadCanvasTemplateNoReload,
  validateCaptcha,
  // @ts-ignore
} from "react-simple-captcha";
import { useAlert } from "../Components/HorusPrompt/horus_alert";

declare global {
  interface Window {
    message: {
      ok: boolean;
      msg: string;
    } | null;
  }
}

export default function LoginRegister() {
  const [fetchedSettings, setFetchedSettings] = useState<boolean>(false);
  const [view, _setView] = useState<"login" | "register" | "reset">("login");
  const [fadeIn, setFadeIn] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<
    "login" | "register" | "reset"
  >("login");
  const [messages, setMessages] = useState<{
    ok: boolean;
    msg: string;
  }>({
    ok: false,
    msg: "",
  });

  const setView = useCallback(
    (newView: "login" | "register" | "reset", resetMessage: boolean = true) => {
      _setView(newView);
      if (resetMessage) {
        setMessages({ ok: false, msg: "" });
      }
    },
    [],
  );

  const isFirstRender = useRef(true);

  const switchViewAnimation = useCallback(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setFadeIn(true);
    setTimeout(() => {
      setCurrentView(view);
      setFadeIn(false);
    }, 500);
  }, [view]);

  const startup = useCallback(async () => {
    await fetchDesktop();

    const href = window.location.href;

    if (href.includes("register")) {
      setView("register");
    }

    if (window.message) {
      setMessages(window.message);
      window.message = null;
    }

    setFetchedSettings(true);
  }, [setMessages, setFetchedSettings, setView]);

  useEffect(() => {
    switchViewAnimation();
  }, [view, switchViewAnimation]);

  useEffect(() => {
    // Fetch the internal settings and the desktop settings
    startup();
  }, [startup]);

  const getCurrentView = useCallback(() => {
    switch (currentView) {
      case "login":
        return <Login setView={setView} setMessages={setMessages} />;
      case "register":
        return <Register setView={setView} setMessages={setMessages} />;
      case "reset":
        return <Reset setView={setView} setMessages={setMessages} />;
      default:
        return <div>Error</div>;
    }
  }, [currentView]);

  if (!fetchedSettings) {
    return (
      <div className="grid place-items-center h-screen bg-transparent">
        <div className="flex flex-col gap-2 items-center">
          <RotatingLines />
          Loading Horus...
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center">
      <Logo className="h-32 mb-4" />
      {messages.msg && (
        <div
          className={`alert ${
            messages.ok ? "alert-success" : "alert-danger"
          } mt-3 max-w-[350px]`}
        >
          {messages.msg}
        </div>
      )}
      <div
        style={{
          opacity: fadeIn ? 0 : 1,
          transition: "opacity 0.5s",
        }}
      >
        {getCurrentView()}
      </div>
      <p className="mt-5 mb-3 text-muted">&copy; 2025 - Horus</p>
    </div>
  );
}

function Login({
  setView,
  setMessages,
}: {
  setView: (newView: "login" | "register" | "reset") => void;
  setMessages: React.Dispatch<
    React.SetStateAction<{
      ok: boolean;
      msg: string;
    }>
  >;
}) {
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [disableLogin, setDisableLogin] = useState(false);

  useEffect(() => {
    const url = new URL(window.location.href);

    // Check if in the url there is a register path
    if (url.pathname.includes("register")) {
      setView("register");
    }
  }, [setView]);

  useEffect(() => {
    // Get the input field
    const email = document.getElementById("email")! as HTMLInputElement;
    const password = document.getElementById("password")! as HTMLInputElement;

    // Execute a function when the user presses a key on the keyboard
    email.addEventListener("keypress", function (event) {
      // If the user presses the "Enter" key on the keyboard
      if (event.key === "Enter") {
        // Cancel the default action, if needed
        event.preventDefault();
        // Trigger the button element with a click
        document.getElementById("signInButton")!.click();
      }
    });

    // Execute a function when the user presses a key on the keyboard
    password.addEventListener("keypress", function (event) {
      // If the user presses the "Enter" key on the keyboard
      if (event.key === "Enter") {
        // Cancel the default action, if needed
        event.preventDefault();
        // Trigger the button element with a click
        document.getElementById("signInButton")!.click();
      }
    });
  }, []);

  const login = async (event: any) => {
    setDisableLogin(true);

    try {
      event.preventDefault();

      const email = (document.getElementById("email")! as HTMLInputElement)
        .value;
      const password = (
        document.getElementById("password")! as HTMLInputElement
      ).value;

      const body = JSON.stringify({
        email: email,
        password: password,
      });

      let response;
      try {
        response = await (await horusPost("/users/login", null, body)).json();
      } catch (error) {
        window.location.href = "/"; // or the redirect URL
        return;
      }

      if (!response.ok) {
        setLoginAttempts(1);
      }

      setMessages({
        ok: response.ok,
        msg: response.msg,
      });

      // Redirect to / if the login was successful
      if (response.ok) {
        window.location.href = "/";
      }
    } finally {
      setDisableLogin(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-2 items-center">
        <div className="w-[350px] flex flex-col gap-2">
          <div className="form-floating">
            <input
              required
              type="email"
              className="form-control"
              id="email"
              name="email"
              placeholder="Email"
            />
            <label htmlFor="email">Email</label>
          </div>
          <div className="form-floating">
            <input
              required
              type="password"
              className="form-control"
              id="password"
              name="password"
              placeholder="Password"
            />
            <label htmlFor="password">Password</label>
          </div>
          <button
            disabled={disableLogin}
            id="signInButton"
            className="bsc-btn w-100 animated-gradient"
            onClick={login}
          >
            {disableLogin ? "Logging in..." : "Sign in"}
          </button>
        </div>
        {loginAttempts > 0 && (
          <button
            onClick={() => {
              setView("reset");
            }}
            className="reset-password"
          >
            <p>Forgot password...</p>
          </button>
        )}
        <div className="h-8"></div>
        <p>Don't have an account?</p>
        <button
          className="bsc-btn animated-gradient w-100 cursor-pointer"
          onClick={() => {
            setView("register");
          }}
        >
          Register
        </button>
        {window.horusInternal?.webApp?.allowDemoUser && (
          <a
            href="/users/demo"
            className="bsc-btn animated-gradient w-100 cursor-pointer text-white"
          >
            Try a demo
          </a>
        )}
      </div>
    </div>
  );
}

type ExtraField = PluginVariable;
type StrippedField = {
  [id: string]: string;
};

function Register({
  setMessages,
  setView,
}: {
  setView: (newView: "login" | "register", resetMessage?: boolean) => void;
  setMessages: React.Dispatch<
    React.SetStateAction<{
      ok: boolean;
      msg: string;
    }>
  >;
}) {
  const [requiredFields, setRequiredFields] = useState<{
    email: string;
    password: string;
  }>({
    email: "",
    password: "",
  });
  const [extraFieldsList, setExtraFieldsList] = useState<ExtraField[]>([]);
  const [extraFieldsValues, setExtraFieldsValues] = useState<StrippedField>({});
  const [captcha, setCaptcha] = useState<string>("");
  const [hasTos, setHasTos] = useState<boolean>(false);
  const [tosAccepted, setTosAccepted] = useState<boolean>(false);
  const [registerDisabled, setRegisterDisabled] = useState(false);

  const register = async () => {
    setRegisterDisabled(true);
    try {
      // Verify the captcha
      if (!validateCaptcha(captcha)) {
        setMessages({ ok: false, msg: "Captcha is invalid" });
        return;
      }

      const parsedFields: StrippedField = {};

      parsedFields["email"] = requiredFields.email;
      parsedFields["password"] = requiredFields.password;

      // If the email or password is missing, alert the user
      if (!parsedFields["email"] || !parsedFields["password"]) {
        setMessages(
          parsedFields["email"]
            ? { ok: false, msg: "Password is required" }
            : { ok: false, msg: "Email is required" },
        );
        return;
      }

      for (const [key, value] of Object.entries(extraFieldsValues)) {
        parsedFields[key] = value;
      }

      // If some field does not have a value, alert the user
      for (const f of extraFieldsList) {
        if (!parsedFields[f.id]) {
          setMessages({ ok: false, msg: `${f.name} is required` });
          return;
        }
      }

      const body = JSON.stringify({
        fields: parsedFields,
      });

      const response = await await horusPost("/users/register", null, body);

      const data = await response.json();

      setMessages({
        ok: data.ok,
        msg: data.msg,
      });

      if (data.ok) {
        // Redirect to login
        setView("login", false);
      }
    } finally {
      setRegisterDisabled(false);
    }
  };

  const horusAlert = useAlert();

  const getFields = async () => {
    const response = await horusGet("/users/fields");
    const json = await response.json();

    if (!response.ok) {
      await horusAlert("Error fetching fields");
      return;
    }

    setExtraFieldsList(json.fields);
    setHasTos(json.hasTos);
    setTosAccepted(!json.hasTos);
  };

  useEffect(() => {
    // Fetch the fields
    getFields();

    // Load captcha
    loadCaptchaEnginge(6);
  }, []);

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="w-[350px] flex flex-col gap-2">
        <div className="form-floating">
          <input
            required
            type="email"
            className="form-control"
            id="email"
            name="email"
            placeholder="Email"
            value={requiredFields.email}
            onChange={(event) => {
              setRequiredFields({
                ...requiredFields,
                email: event.target.value,
              });
            }}
          />
          <label htmlFor="email">Email</label>
        </div>
        <div className="form-floating">
          <input
            required
            type="password"
            className="form-control"
            id="password"
            name="password"
            placeholder="password"
            value={requiredFields.password}
            onChange={(event) => {
              setRequiredFields({
                ...requiredFields,
                password: event.target.value,
              });
            }}
          />
          <label htmlFor="password">Password</label>
        </div>
        <div className="mt-8"></div>
        {extraFieldsList.map((field, index) => {
          return (
            <>
              <label htmlFor={field.id}>{field.name}</label>
              <div className="form-floating bg-white" key={index} id={field.id}>
                <PluginVariableView
                  customClass="form-control"
                  hideDescription={false}
                  applyStyle={false}
                  hideName={true}
                  variable={field}
                  onChange={(newValue) => {
                    setExtraFieldsValues((currentValues) => {
                      return {
                        ...currentValues,
                        [field.id]: newValue,
                      };
                    });
                  }}
                />
              </div>
            </>
          );
        })}
        <div className="mt-8"></div>
        {hasTos && (
          <div
            className="w-full flex flex-row gap-4 justify-between items-center form-control"
            style={{
              width: "unset",
              display: "flex",
            }}
          >
            <div>
              I accept the{" "}
              <a href="/tos" target="_blank" className="text-blue-500">
                Terms of Service
              </a>
            </div>
            <HorusSwitch enabled={tosAccepted} setEnabled={setTosAccepted} />
          </div>
        )}
        <div className="flex flex-row gap-2 items-center justify-center">
          <div className="form-floating">
            <input
              type="text"
              className="form-control"
              id="captcha"
              name="captcha"
              placeholder="captcha"
              value={captcha}
              onChange={(event) => {
                setCaptcha(event.target.value);
              }}
            />
            <label htmlFor="captcha">Captcha</label>
          </div>
          <div
            className="form-floating"
            style={{
              padding: "0",
            }}
          >
            <div
              className="form-control flex items-center justify-center h-full"
              style={{
                paddingTop: "1rem",
              }}
            >
              <LoadCanvasTemplateNoReload />
            </div>
          </div>
        </div>
        <button
          className="bsc-btn w-100 animated-gradient"
          onClick={register}
          disabled={registerDisabled || (hasTos && !tosAccepted)}
        >
          {registerDisabled ? "Registering..." : "Register"}
        </button>
      </div>
      <div className="mt-4">Already have an account?</div>
      <button
        className="bsc-btn animated-gradient w-100"
        onClick={() => {
          setView("login");
        }}
      >
        Go back
      </button>
    </div>
  );
}

function Reset({
  setMessages,
  setView,
}: {
  setView: (newView: "login" | "register", resetMessage?: boolean) => void;
  setMessages: React.Dispatch<
    React.SetStateAction<{
      ok: boolean;
      msg: string;
    }>
  >;
}) {
  const [email, setEmail] = useState("");
  const horusAlert = useAlert();

  const resetPassword = async () => {
    const body = JSON.stringify({
      email,
    });

    const response = await horusPost("/users/reset", null, body);

    if (!response) {
      await horusAlert("An error occurred. Try again later.");
      return;
    }

    const data = await response.json();

    if (data.ok) {
      setMessages({
        msg:
          data.msg ?? "An email has ben sent in order to reset the password.",
        ok: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      window.location.href = "/users/login";
    } else {
      setMessages({
        msg: data.msg ?? "An error occurred. Try again later.",
        ok: false,
      });
    }
  };

  return (
    <div className="flex flex-col gap-2 items-center">
      <div className="w-[350px] flex flex-col gap-2">
        <div className="form-floating">
          <input
            required
            type="email"
            className="form-control"
            id="email"
            name="email"
            placeholder="Email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          <label htmlFor="email">Email</label>
        </div>

        <button
          className="bsc-btn w-100 animated-gradient"
          onClick={resetPassword}
        >
          Reset password
        </button>
      </div>
      <button
        className="bsc-btn animated-gradient w-100"
        onClick={() => {
          setView("login");
        }}
      >
        Go back
      </button>
    </div>
  );
}
