import { useEffect, useState } from "react";
import { horusGet, horusPost } from "../Utils/utils";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import Logo from "../Components/logo";
import "../Components/appbutton.css";
import "../Components/FlowBuilder/Blocks/block.css";
import LockIcon from "../Components/Toolbar/Icons/Lock";
import { useAlert } from "../Components/HorusPrompt/horus_alert";
import { useConfirm } from "../Components/HorusPrompt/horus_confirm";

type UserQuota = {
  currentFlows: number;
  currentTemplates: number;
  usedSpace: number;
  usedHours: number;
  maxFlows: number;
  maxTemplates: number;
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

function hourFormat(quota: UserQuota) {
  const usedHoursNumber = Number(quota.usedHours || 0);
  const maxHoursnumber = Number(quota.maxHours || 0);

  const h = Math.floor(usedHoursNumber);
  const m = Math.floor((usedHoursNumber - h) * 60);
  const used = `${h}h ${m}m`;

  let max = "∞";
  if (maxHoursnumber) {
    const maxH = Math.floor(maxHoursnumber);
    const maxM = Math.floor((maxHoursnumber - maxH) * 60);
    max = `${maxH}h`;

    if (maxM > 0) {
      max += ` ${maxM}m`;
    }
  }

  return `${used} / ${max}`;
}

export function useUser() {
  const [userData, setUserData] = useState<UserData | null>(null);

  const fetchUser = async () => {
    // If horus is not running on webapp mode, skip this
    if (!window.horusInternal?.webApp) {
      return;
    }

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

  useEffect(() => {
    fetchUser();
  }, []);

  return { userData, fetchUser };
}

export default function Profile() {
  const { userData } = useUser();

  const horusConfirm = useConfirm();
  const horusAlert = useAlert();

  const resetPassword = async () => {
    const response = await horusGet("/users/reset");
    if (!response) {
      await horusAlert("An error occurred. Try again later.");
    }
    const data = await response.json();

    if (data.ok) {
      await horusAlert(
        "An email has been sent to your email address with instructions"
      );
    } else {
      await horusAlert(data.msg || "An error occurred. Try again later.");
    }
  };

  const deleteAccount = async () => {
    if (
      !(await horusConfirm(
        "Are you sure you want to delete your account? This action is irreversible."
      ))
    ) {
      return;
    }

    const response = await horusGet("/users/delete");
    if (!response) {
      await horusAlert("An error occurred. Try again later.");
    }
    const data = await response.json();

    if (data.ok) {
      await horusAlert("Your account has been deleted");
      window.location.href = "/users/login";
    } else {
      await horusAlert(data.msg || "An error occurred. Try again later.");
    }
  };

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
                {userData.quota.currentFlows} / {userData.quota.maxFlows ?? "∞"}
              </div>
              <div className="plugin-block mb-2">
                <span className="font-bold">Templates:</span>{" "}
                {userData.quota.currentTemplates} /{" "}
                {userData.quota.maxTemplates ?? "∞"}
              </div>
              <div className="plugin-block mb-2">
                <UsedSpace
                  used={userData.quota?.usedSpace}
                  maximum={userData.quota?.maxSpace}
                />
              </div>
              <div className="plugin-block mb-2">
                <span className="font-bold">Computation hours:</span>{" "}
                {hourFormat(userData.quota)}
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
              className="bsc-btn animated-gradient w-100 cursor-pointer text-white"
            >
              Logout
            </a>
            <button
              className="bsc-btn animated-gradient w-100 cursor-pointer text-white"
              onClick={resetPassword}
            >
              Reset password
            </button>
            <button
              className="bsc-btn animated-gradient w-100 cursor-pointer font-bold"
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

function UsedSpace({ used, maximum }: { used?: number; maximum?: number }) {
  const parsedSpace = (space: number | undefined) => {
    if (space || space === 0) {
      // The space are MB, but if higher than 1000, then it's GB
      if (space > 1000) {
        return <span>{(space / 1000).toFixed(2)} GB</span>;
      } else if (space < 1) {
        return <span>{(space * 1000).toFixed(2)} KB</span>;
      } else {
        return <span>{space.toFixed(2) ?? 0} MB</span>;
      }
    }

    return "Unknown";
  };

  return (
    <>
      <span className="font-bold">Used space:</span> {parsedSpace(used)} /{" "}
      {maximum ? parsedSpace(maximum) : "∞"}
    </>
  );
}
