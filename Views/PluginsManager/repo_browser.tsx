import { useState } from "react";
import { PluginInstallProps } from "./plugin_manager";
import { useQuery } from "@tanstack/react-query";
import { horusGet } from "../Utils/utils";
import { HorusPlugin } from "../Components/FlowBuilder/flow.types";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import ErrorIcon from "../Components/Toolbar/Icons/Error";
import CheckMark from "../Components/Toolbar/Icons/CheckMark";

import PluginsIcon from "../Components/Toolbar/Icons/Plugins";
import AppButton from "../Components/appbutton";
import InfoIcon from "../Components/Toolbar/Icons/Info";
import CloudDownload from "../Components/Toolbar/Icons/CloudDownload";
import SettingsIcon from "../Components/Toolbar/Icons/Settings";
import LogFile from "../Components/Toolbar/Icons/LogFile";
import { SearchComponent } from "@/Components/Search/Search";

type DatabasePlugin = HorusPlugin & {
  downloads: number;
  latest_version: string;
};

export function PluginBrowserRoot(props: PluginInstallProps) {
  return <RepoBrowser {...props} />;
}

function RepoBrowser(props: PluginInstallProps) {
  const {
    data: installedPlugins,
    isLoading: installedPluginsLoading,
    error: installedPluginsError,
  } = useQuery({
    queryKey: ["installed_plugins"],
    queryFn: () => {
      return horusGet("/api/plugins/list")
        .then((res) => res.json())
        .then((data) => data.plugins.plugins);
    },
  });

  if (installedPluginsLoading) {
    return <LoadingPluginRepo />;
  }

  if (installedPluginsError) {
    return <CannotConnectError />;
  }

  return <_RepoBrowser {...props} installedPlugins={installedPlugins ?? []} />;
}

function _RepoBrowser(
  props: PluginInstallProps & {
    installedPlugins: HorusPlugin[];
  }
) {
  const [filterTerm, setFilterTerm] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plugins"],
    queryFn: () => {
      const url = new URL("https://horus.bsc.es/repo_api/plugins");
      url.searchParams.append("query", filterTerm);
      url.searchParams.append("query", filterTerm);
      return fetch(url.toString())
        .then((res) => res.json())
        .then((data) => data as { plugins: DatabasePlugin[]; total: number });
    },
  });

  if (isLoading) {
    return <LoadingPluginRepo />;
  }

  if (error) {
    return <CannotConnectError />;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-row gap-2 items-center">
        <SearchComponent
          className="w-full"
          placeholder="Search plugins..."
          onChange={(e) => {
            setFilterTerm(e.target.value);
          }}
          onEnter={() => refetch()}
        />
        <AppButton
          action={() => {
            const button = document.createElement("a");
            button.target = "_blank";
            button.href = "https://horus.bsc.es/repo";
            button.click();
            button.remove();
          }}
        >
          Open repository
        </AppButton>
      </div>
      <div className="grid grid-cols-1 gap-2">
        {data?.plugins.map((plugin) => (
          <PluginInRepo
            key={plugin.name}
            plugin={plugin}
            isInstalled={props.installedPlugins.find((p) => p.id === plugin.id)}
            onInstall={props.onPluginInstall}
          />
        ))}
      </div>
    </div>
  );
}

function PluginInRepo({
  plugin,
  isInstalled,
  onInstall,
}: {
  plugin: DatabasePlugin;
  isInstalled?: HorusPlugin;
  onInstall: (file: string) => void;
}) {
  return (
    <div className="card plugin-card animated-gradient">
      <div className="grid grid-cols-[100px_auto]">
        <div className="my-2 ml-2 grid place-items-center overflow-hidden rounded">
          {plugin.logo ? (
            <img
              src={plugin.logo}
              alt={plugin.name}
              className="w-20 h-20 object-contain"
            />
          ) : (
            <PluginsIcon className="w-20 h-20" />
          )}
        </div>
        <div className="card-body flex justify-content-between align-items-start">
          <div className="flex flex-col gap-2 justify-between h-full">
            <div>
              <div className="flex flex-row items-baseline gap-2">
                <div>
                  <span className="text-xl font-semibold">{plugin.name}</span>
                  <span> - {plugin.description}</span>
                </div>
              </div>
              <div>Author: {plugin.author}</div>
            </div>
            <a
              href={`https://horus.bsc.es/repo/plugins/${plugin.id}`}
              className="hover:text-blue-500"
              target="_blank"
            >
              <AppButton
                style={{ color: "black", cursor: "pointer !important" }}
                className="flex flex-row items-center gap-2"
              >
                <InfoIcon /> View on repository
              </AppButton>
            </a>
          </div>
          <div className="flex flex-col gap-2 h-full">
            {isInstalled ? (
              <AppButton
                disabled={plugin.latest_version === isInstalled.version}
                className="grid grid-cols-[80px_20px] gap-2"
                style={{
                  width: "100px",
                  color:
                    isInstalled.version !== plugin.latest_version
                      ? "orange"
                      : "green",
                }}
                action={() => {
                  const pluginURL = `pluginID://${plugin.id}`;
                  onInstall(pluginURL);
                }}
              >
                <span className="font-semibold">
                  {plugin.latest_version !== isInstalled.version
                    ? "Update"
                    : "Installed"}
                </span>
                {plugin.latest_version !== isInstalled.version ? (
                  <ErrorIcon className="w-10 h-10" />
                ) : (
                  <CheckMark className="w-10 h-10" />
                )}
              </AppButton>
            ) : (
              <AppButton
                className="grid grid-cols-[80px_20px] gap-2"
                style={{ color: "black", width: "100px" }}
                action={() => {
                  const pluginURL = `pluginID://${plugin.id}`;
                  onInstall(pluginURL);
                }}
              >
                <span className="font-semibold w-[90px]">Install</span>
                <SettingsIcon className="w-10 h-10" />
              </AppButton>
            )}
            <AppButton
              style={{ color: "black", width: "100px", font: "semibold" }}
              className="grid grid-cols-[80px_20px] gap-2"
            >
              <span className="font-semibold w-[90px]">
                {plugin.latest_version}
              </span>
              <LogFile className="w-10 h-10" />
            </AppButton>
            <AppButton
              style={{ color: "black", width: "100px" }}
              className="grid grid-cols-[80px_20px] gap-2"
            >
              <span className="font-semibold w-[90px]">{plugin.downloads}</span>
              <CloudDownload className="w-10 h-10" />
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingPluginRepo() {
  return (
    <div>
      <div className="grid place-items-center h-full">
        <RotatingLines />
        Connecting to the Horus Plugin Repository...
      </div>
    </div>
  );
}
function CannotConnectError() {
  return (
    <div className="grid place-items-center h-full text-red-500">
      <ErrorIcon className="w-10 h-10" />
      Could not connect to the Horus Plugin Repository
    </div>
  );
}
