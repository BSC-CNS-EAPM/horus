import { useEffect, useState } from "react";
import { fetchDesktop, horusPost } from "../Utils/utils";
import Logo from "../Components/logo";
import "../Components/appbutton.css";
import "../Components/FlowBuilder/Blocks/block.css";

declare global {
  interface Window {
    mail?: string;
  }
}

export default function Reset() {
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState<null | {
    text: string;
    type: "error" | "success";
  }>(null);

  const sendResetPassword = async () => {
    // Send the token to the server
    // The token is in the URL
    const token = new URLSearchParams(window.location.search).get("token");

    if (!token) {
      alert("Invalid token");
      return;
    }

    const body = JSON.stringify({
      token,
      newPassword: newPassword,
    });

    const response = await horusPost("/users/reset", null, body);

    if (!response) {
      alert("An error occurred. Try again later.");
      return;
    }

    const data = await response.json();

    if (data.ok) {
      setMessage({
        text: "Password reset successfully, redirecting to login...",
        type: "success",
      });
      await new Promise((resolve) => setTimeout(resolve, 2000));
      window.location.href = "/users/login";
    } else {
      setMessage({
        text: data.msg ?? "An error occurred. Try again later.",
        type: "error",
      });
    }
  };

  useEffect(() => {
    fetchDesktop();

    if (!window.mail) {
      window.location.href = "/users/login";
    }
  }, []);

  return (
    <div
      className="container mx-auto px-4"
      style={{
        maxWidth: "600px",
        minWidth: "300px",
      }}
    >
      <Logo className="h-32 mx-auto my-4" />
      {message && (
        <div
          className={`border px-4 py-3 rounded relative mb-4 ${
            message.type === "error"
              ? " bg-red-100 border-red-400 text-red-700"
              : "bg-green-100 border-green-400 text-green-700"
          }`}
        >
          <span className="block sm:inline">{message.text}</span>
        </div>
      )}
      <h1 className="text-center text-2xl font-bold mb-4">
        Reset your password at{" "}
        {window.horusInternal?.webApp?.appName ?? "Horus"}
      </h1>
      <div className="plugin-block flex flex-col gap-2 mb-4">
        <input
          disabled
          className="input plugin-variable"
          value={window.mail}
          type="email"
          placeholder="Email"
        />
        <hr></hr>
        <input
          type="password"
          placeholder="New password"
          className="input plugin-variable"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </div>
      <button
        className="nbd-btn animated-gradient w-100 cursor-pointer text-white"
        onClick={sendResetPassword}
      >
        Reset password
      </button>
    </div>
  );
}
