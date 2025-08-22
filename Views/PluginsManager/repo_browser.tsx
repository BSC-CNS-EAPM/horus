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
import CloudDownload from "../Components/Toolbar/Icons/CloudDownload";
import SettingsIcon from "../Components/Toolbar/Icons/Settings";
import LogFile from "../Components/Toolbar/Icons/LogFile";
import { SearchComponent } from "@/Components/Search/Search";

type DatabasePlugin = HorusPlugin & {
  downloads: number;
  latest_version: string;
  repo_url: string;
};

type RepoBrowserProps = PluginInstallProps & {
  repoURL: string;
  repoName: string;
  repoToken?: string;
};

export function PluginBrowserRoot(props: RepoBrowserProps) {
  return <RepoBrowser {...props} />;
}

function RepoBrowser(props: RepoBrowserProps) {
  const {
    data: installedPlugins,
    isLoading: installedPluginsLoading,
    error: installedPluginsError,
  } = useQuery({
    queryKey: [
      "installed_plugins",
      props.repoURL,
      props.repoName,
      props.repoToken,
    ],
    queryFn: () => {
      return horusGet("/api/plugins/list")
        .then((res) => res.json())
        .then((data) => data.plugins.plugins);
    },
    refetchInterval: false,
  });

  if (installedPluginsLoading) {
    return <LoadingPluginRepo repoName={props.repoName} />;
  }

  if (installedPluginsError) {
    return <CannotConnectError repoName={props.repoName} />;
  }

  return <_RepoBrowser {...props} installedPlugins={installedPlugins ?? []} />;
}

function _RepoBrowser(
  props: RepoBrowserProps & {
    installedPlugins: HorusPlugin[];
  }
) {
  const [filterTerm, setFilterTerm] = useState("");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["plugins", props.repoURL, props.repoName, props.repoToken],
    queryFn: () => {
      const url = new URL(`${props.repoURL}/plugins/`);

      url.searchParams.append("query", filterTerm);

      return fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${props.repoToken}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data || !Array.isArray(data.plugins)) {
            throw new Error("No plugins found in repository response");
          }
          return data as { plugins: DatabasePlugin[]; total: number };
        });
    },
  });

  if (isLoading) {
    return <LoadingPluginRepo repoName={props.repoName} />;
  }

  if (error || !data?.plugins) {
    return <CannotConnectError repoName={props.repoName} />;
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
          className="min-w-[200px]"
          action={() => {
            const button = document.createElement("a");
            button.target = "_blank";
            button.href = props.repoURL;
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
            repo={props.repoURL}
            repoName={props.repoName}
          />
        ))}
      </div>
    </div>
  );
}

function PluginInRepo({
  plugin,
  isInstalled,
  repo,
  repoName,
  onInstall,
}: {
  plugin: DatabasePlugin;
  isInstalled?: HorusPlugin;
  repo: string;
  repoName: string;
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
            {/* <a
              href={`${repo}/plugins/${plugin.id}`}
              className="hover:text-blue-500"
              target="_blank"
            >
              <AppButton
                style={{ color: "black", cursor: "pointer !important" }}
                className="flex flex-row items-center gap-2"
              >
                <InfoIcon /> View on repository
              </AppButton>
            </a> */}
          </div>
          <RightSidePluginDownload
            isInstalled={isInstalled}
            plugin={plugin}
            onInstall={onInstall}
            repoURL={repo}
            repoName={repoName}
          />
        </div>
      </div>
    </div>
  );
}

function RightSidePluginDownload({
  isInstalled,
  plugin,
  repoURL,
  repoName,
  onInstall,
}: {
  isInstalled?: HorusPlugin;
  plugin: DatabasePlugin;
  repoURL: string;
  repoName: string;
  onInstall: (file: string) => void;
}) {
  const width = "120px";
  const spanClassName = "font-semibold w-[90px]";
  return (
    <div className="flex flex-col gap-2 h-full">
      {isInstalled ? (
        <AppButton
          disabled={plugin.latest_version === isInstalled.version}
          className="gap-2 flex flex-row flex-nowrap justify-between"
          style={{
            width: width,
            color:
              isInstalled.version !== plugin.latest_version
                ? "orange"
                : "green",
          }}
          action={() => {
            const pluginURL = `repoID://${repoURL}repoName://${repoName}pluginID://${plugin.id}`;
            onInstall(pluginURL);
          }}
        >
          <span className={spanClassName}>
            {plugin.latest_version !== isInstalled.version
              ? "Update"
              : "Installed"}
          </span>
          {plugin.latest_version !== isInstalled.version ? (
            <ErrorIcon className="w-6 h-6" />
          ) : (
            <CheckMark className="w-6 h-6" />
          )}
        </AppButton>
      ) : (
        <AppButton
          className="gap-2 flex flex-row flex-nowrap justify-between"
          style={{ color: "black", width: width }}
          action={() => {
            const pluginURL = `repoID://${repoURL}repoName://${repoName}pluginID://${plugin.id}`;
            onInstall(pluginURL);
          }}
        >
          <span className={spanClassName}>Install</span>
          <SettingsIcon className="w-6 h-6" />
        </AppButton>
      )}
      <AppButton
        style={{ color: "black", width: width, font: "semibold" }}
        className="gap-2 flex flex-row flex-nowrap justify-between"
      >
        <span className={spanClassName}>{plugin.latest_version}</span>
        <LogFile className="w-6 h-6" />
      </AppButton>
      <AppButton
        style={{ color: "black", width: width }}
        className="gap-2 flex flex-row flex-nowrap justify-between"
      >
        <span className={spanClassName}>{plugin.downloads}</span>
        <CloudDownload className="w-6 h-6" />
      </AppButton>
    </div>
  );
}

function LoadingPluginRepo({ repoName }: { repoName: string }) {
  return (
    <div>
      <div className="grid place-items-center h-full">
        <RotatingLines />
        Connecting to &quot;{repoName}&quot; plugin repository...
      </div>
    </div>
  );
}
function CannotConnectError({ repoName }: { repoName: string }) {
  return (
    <div className="grid place-items-center h-full text-red-500">
      <ErrorIcon className="w-10 h-10" />
      Could not connect to &quot;{repoName}&quot; plugin repository
    </div>
  );
}
