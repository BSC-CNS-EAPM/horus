import { useEffect, useState } from "react";
import { horusGet, horusPost } from "../Utils/utils";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import Logo from "../Components/logo";
import "../Components/nbdbutton.css";
import "../Components/FlowBuilder/Blocks/block.css";
import LockIcon from "../Components/Toolbar/Icons/Lock";

type UserQuota = {
  currentFlows: number;
  usedSpace: number;
  usedHours: number;
  maxFlows: number;
  maxSpace: number;
  maxHours: number;
};

type UserData = {
  username: string;
  email: string;
  group: string;
  admin: boolean;
  registration_date: string;
  // Can be optional as maybe the webapp doesn't have quotas
  quota?: UserQuota;
};

export default function Profile() {
  const [userData, setUserData] = useState<UserData | null>(null);

  const fetchUser = async () => {
    const response = await horusPost("/users/profile", null, null);
    if (!response) {
      return;
    }
    const data = await response.json();

    if (!data.logged) {
      window.location.href = "/users/login";
    }

    setUserData(data.user);
  };

  const resetPassword = async () => {
    const response = await horusGet("/users/reset");
    if (!response) {
      alert("An error occurred. Try again later.");
    }
    const data = await response.json();

    if (data.ok) {
      alert("An email has been sent to your email address with instructions");
    } else {
      alert(data.msg || "An error occurred. Try again later.");
    }
  };

  const deleteAccount = async () => {
    if (
      !confirm(
        "Are you sure you want to delete your account? This action is irreversible."
      )
    ) {
      return;
    }

    const response = await horusGet("/users/delete");
    if (!response) {
      alert("An error occurred. Try again later.");
    }
    const data = await response.json();

    if (data.ok) {
      alert("Your account has been deleted");
      window.location.href = "/users/login";
    } else {
      alert(data.msg || "An error occurred. Try again later.");
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  if (!userData) {
    return (
      <div className="flex flex-row w-full justify-center items-center">
        <RotatingLines />
      </div>
    );
  }

  return (
    <div
      className="container mx-auto px-4"
      style={{
        maxWidth: "600px",
      }}
    >
      <Logo className="h-32 mx-auto my-4" />
      <h1 className="text-center text-2xl font-bold mb-4">
        Your profile at {window.horusInternal?.webApp?.appName ?? "Horus"}
      </h1>
      {userData && (
        <>
          <div className="plugin-block mb-2">
            <span className="font-bold">Email:</span> {userData.email}
          </div>
          {userData.quota && (
            <>
              <div className="plugin-block mb-2">
                <span className="font-bold">Flows:</span>{" "}
                {userData.quota.currentFlows} /{" "}
                {userData.quota.maxFlows ?? "Unlimited"}
              </div>
              <div className="plugin-block mb-2">
                <span className="font-bold">Used space:</span>{" "}
                {userData.quota.usedSpace} /{" "}
                {userData.quota.maxSpace ?? "Unlimited"} MB
              </div>
              <div className="plugin-block mb-2">
                <span className="font-bold">Computation hours:</span>{" "}
                {userData.quota?.usedHours.toFixed(2)} /{" "}
                {userData.quota?.maxHours}h
              </div>
            </>
          )}
          <div>
            {userData.admin && (
              <a
                className="plugin-block mb-2 p-2 flex flex-row justify-between items-center cursor-pointer"
                style={{
                  color: "var(--waring-orange)",
                }}
                href="/users/admintools"
                target="_blank"
              >
                Enter AdminTools <LockIcon />
              </a>
            )}
          </div>
          <div className="flex flex-col gap-2 mb-4">
            <a
              href="/users/logout"
              className="nbd-btn animated-gradient w-100 cursor-pointer text-white"
            >
              Logout
            </a>
            <button
              className="nbd-btn animated-gradient w-100 cursor-pointer text-white"
              onClick={resetPassword}
            >
              Reset password
            </button>
            <button
              className="nbd-btn animated-gradient w-100 cursor-pointer font-bold"
              onClick={deleteAccount}
              style={{
                color: "red",
              }}
            >
              Delete account
            </button>
          </div>
        </>
      )}
    </div>
  );
}
