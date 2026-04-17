// React
import { useCallback, useEffect, useRef, useState } from "react";

// Horus web-server
import { horusPost, horusGet } from "../Utils/utils";

// Horus components
import AppButton from "../Components/appbutton";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import BackArrowIcon from "../Components/Toolbar/Icons/BackArrow";
import { PluginVariableTypes } from "@/Components/FlowBuilder/flow.types";
import { PluginVariableView } from "@/Components/FlowBuilder/Variables/variables";

// TS type
import { Remote } from "./remote";

// CSS
import "../Components/FlowBuilder/Blocks/block.css";
import "../PluginsManager/plugin_manager.css";

const NEW_REMOTE = "New remote";
const SAVE_REMOTE = "Save remote";
const UPDATE_REMOTE = "Update remote";
const SAVE_AS = "Save as new remote";
const BUTTON_ID = "save-remote-button";

export default function ConfigRemotes() {
  const [fetchingRemotes, setFetchingRemotes] = useState<boolean>(false);
  const [remotes, setRemotes] = useState<Remote[] | null>(null);
  const [editingRemote, setEditingRemote] = useState<Remote | null>(null);
  const [subView, setSubView] = useState<React.ReactNode | null>(null);

  const getRemotes = async () => {
    setFetchingRemotes(true);
    const response = await horusGet("/api/remotes/list");
    const fetchedRemotes = await response.json();

    setRemotes(fetchedRemotes);

    setFetchingRemotes(false);
  };

  const handleSubView = (subView: React.ReactNode) => {
    setSubView(subView);
  };

  const handleNewRemote = () => {
    handleSubView(
      <DetailedRemote key="new-remote" setEditingRemote={setEditingRemote} />
    );
  };

  const returnToMainView = () => {
    getRemotes();
    setEditingRemote(null);
    setSubView(null);
    const btn = document.getElementById(BUTTON_ID);
    if (btn) {
      btn.innerHTML = NEW_REMOTE;
    }
  };

  const handleRemoteEdit = async (remoteData: Remote) => {
    const header = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    const body = JSON.stringify(remoteData);

    const response = await horusPost("/api/remotes/configure", header, body);

    const data = await response.json();

    if (!data.ok) {
      await alert("Failed to configure remote: " + data.msg);
      return;
    }

    returnToMainView();
  };

  useEffect(() => {
    // Retrieve the data
    getRemotes();
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-col gap-1 items-center h-full">
        <div className="plugin-manager-title flex w-full">
          <div
            className="
            text-2xl
            font-semibold
            flex
            justify-center
            items-center
            gap-2
            ml-2
          "
          >
            Remotes
          </div>
          <div className="flex flex-row gap-2 mr-2">
            {subView && editingRemote && (
              <AppButton
                id={BUTTON_ID}
                style={{
                  background: subView ? "orange" : undefined
                }}
                action={
                  subView && editingRemote
                    ? () => {
                        handleRemoteEdit(editingRemote);
                      }
                    : handleNewRemote
                }
              >
                {subView ? SAVE_REMOTE : NEW_REMOTE}
              </AppButton>
            )}
            {!subView && (
              <AppButton id={BUTTON_ID} action={handleNewRemote}>
                {NEW_REMOTE}
              </AppButton>
            )}
            <a
              className="app-button text-black text-decoration-none"
              href="https://horus.bsc.es/docs/developer_guide/horusapi/remotes.html"
              target="_blank"
            >
              Learn more about remotes
            </a>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto w-full">
          {subView ? (
            <>
              <div className="p-2 flex flex-row fade-in-animation w-full">
                <button onClick={returnToMainView}>
                  <BackArrowIcon className="w-10 h-10" />
                </button>
                <div className="flex-grow p-2">{subView}</div>
              </div>
            </>
          ) : (
            <RemoteListView
              remotes={remotes ?? []}
              isLoading={fetchingRemotes}
              handleSubView={handleSubView}
              returnToMainView={returnToMainView}
              setEditingRemote={setEditingRemote}
            />
          )}
        </div>
      </div>
    </div>
  );
}

type RemoteListProps = {
  remotes: Remote[];
  isLoading: boolean;
  handleSubView(subView: React.ReactNode): void;
  returnToMainView(): void;
  setEditingRemote(remote: Remote): void;
};

function RemoteListView(props: RemoteListProps) {
  const { remotes, handleSubView, returnToMainView, setEditingRemote } = props;

  if (props.isLoading) {
    return (
      <div className="w-fit h-fit p-2 m-2 flex flex-col justify-center items-center">
        <RotatingLines />
        Loading remotes...
      </div>
    );
  }

  if (!remotes || remotes.length === 0) {
    return (
      <div className="w-fit h-fit p-2 m-2 flex flex-col justify-center items-center">
        No remotes found
      </div>
    );
  }

  return (
    <div className="fade-in-animation p-2 w-full flex flex-col gap-2">
      {remotes?.map((remote) => (
        <RemoteView
          key={remote.name}
          remote={remote}
          handleEdit={(remote) =>
            handleSubView(
              <DetailedRemote
                remote={remote}
                setEditingRemote={setEditingRemote}
              />
            )
          }
          updateList={returnToMainView}
        />
      ))}
    </div>
  );
}

interface RemoteViewProps {
  remote: Remote;
  handleEdit(remote: any): void;
  updateList(): void;
}

function RemoteView(props: RemoteViewProps) {
  const remote = props.remote;

  const handleDelete = async () => {
    const data = {
      name: remote.name
    };

    const header = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };

    const body = JSON.stringify(data);

    const response = await horusPost("/api/remotes/delete", header, body);

    if (!response.ok) {
      await alert("Failed to delete remote");
    } else {
      props.updateList();
    }
  };

  const handleEdit = async () => {
    props.handleEdit(remote);
  };

  return (
    <div
      onClick={handleEdit}
      className="card plugin-card animated-gradient w-full p-2 flex flex-row justify-between items-center"
    >
      <div className="flex flex-col">
        <div className="text-xl font-semibold">{remote.name}</div>
        <div>
          {remote.username}@{remote.host}
        </div>
      </div>
      <div className="flex flex-row gap-1">
        <button onClick={handleEdit}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-5 h-5"
          >
            <path
              fillRule="evenodd"
              d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z"
              clipRule="evenodd"
            />
          </svg>
        </button>
        <button onClick={handleDelete}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="red"
            className="w-6 h-6"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

interface DetailedRemoteViewProps {
  remote?: Remote;
  setEditingRemote(remote: Remote): void;
}

function DetailedRemote(props: DetailedRemoteViewProps) {
  const [remoteData, _setRemoteData] = useState<Remote | null>(
    props.remote ?? null
  );

  const setRemoteData = useCallback(
    (remote: Remote) => {
      props?.setEditingRemote && props.setEditingRemote(remote);
      _setRemoteData(remote);
    },
    [props]
  );

  return (
    <div className="flex flex-col gap-2 h-full w-full justify-center items-center">
      <RemoteVariablesView
        remoteData={remoteData}
        setRemoteData={setRemoteData}
      />
    </div>
  );
}

type RemoteVariablesViewProps = {
  remoteData: Remote | null;
  setRemoteData: (remoteData: Remote) => void;
};

function RemoteVariablesView(props: RemoteVariablesViewProps) {
  const { remoteData, setRemoteData: _setRemoteData } = props;

  const setRemoteData = (remoteData: Remote) => {
    // For any value that is an empty string, set it to null
    Object.keys(remoteData).forEach((key) => {
      const value = remoteData[key as keyof Remote];
      if (value === "") {
        // @ts-ignore
        remoteData[key] = null;
      }
    });
    _setRemoteData(remoteData);
  };

  const originalName = useRef(remoteData?.name);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-col gap-2">
        <PluginVariableView
          variable={{
            name: "Name",
            id: "remote-name",
            description: "The name of the remote",
            type: PluginVariableTypes.STRING,
            value: remoteData?.name,
            placedID: 0,
            allowedValues: [],
            defaultValue: "",
            category: "Remote",
            disabled: false,
            required: true
          }}
          onChange={(value) => {
            setRemoteData({ ...remoteData, name: value } as Remote);
            if (!originalName.current) return;

            const saveButton = document.getElementById(BUTTON_ID);

            if (!saveButton) {
              return;
            }

            if (value !== originalName.current) {
              saveButton.innerHTML = SAVE_AS;
            } else {
              saveButton.innerHTML = UPDATE_REMOTE;
            }
          }}
        />

        <PluginVariableView
          variable={{
            name: "Host",
            id: "remote-host",
            description: "The host of the remote",
            type: PluginVariableTypes.STRING,
            value: remoteData?.host,
            placedID: 1,
            allowedValues: [],
            defaultValue: "",
            category: "Remote",
            disabled: false,
            required: true
          }}
          onChange={(value) =>
            setRemoteData({ ...remoteData, host: value } as Remote)
          }
        />

        <PluginVariableView
          variable={{
            name: "Username",
            id: "remote-username",
            description: "Your username on the remote",
            type: PluginVariableTypes.STRING,
            value: remoteData?.username,
            placedID: 2,
            allowedValues: [],
            defaultValue: "",
            category: "Remote",
            disabled: false,
            required: true
          }}
          onChange={(value) =>
            setRemoteData({ ...remoteData, username: value } as Remote)
          }
        />

        <PluginVariableView
          variable={{
            name: "Port",
            id: "remote-port",
            description: "The port of the remote",
            type: PluginVariableTypes.STRING,
            value: remoteData?.port ?? "22",
            placedID: 3,
            allowedValues: [],
            defaultValue: "",
            category: "Remote",
            disabled: false,
            required: false
          }}
          onChange={(value) =>
            setRemoteData({ ...remoteData, port: value } as Remote)
          }
        />

        <PluginVariableView
          variable={{
            name: "Password",
            id: "remote-password",
            description: "Optional if using key file",
            type: PluginVariableTypes.PASSWORD,
            value: remoteData?.password,
            placedID: 4,
            allowedValues: [],
            defaultValue: "",
            category: "Remote",
            disabled: false,
            required: false,
            placeholder: "Optional if using key file"
          }}
          onChange={(value) =>
            setRemoteData({ ...remoteData, password: value } as Remote)
          }
        />

        <PluginVariableView
          variable={{
            name: "Key file",
            id: "remote-key-path",
            description: "Optional if using password",
            type: PluginVariableTypes.FILE,
            value: remoteData?.keyPath,
            placedID: 5,
            allowedValues: [],
            defaultValue: "",
            category: "Remote",
            disabled: false,
            required: false,
            placeholder: "Optional if using password"
          }}
          onChange={(value) =>
            setRemoteData({ ...remoteData, keyPath: value } as Remote)
          }
        />

        <PluginVariableView
          variable={{
            name: "ProxyCommand",
            id: "remote-proxy-command",
            description: "A proxy command to use (optional)",
            type: PluginVariableTypes.STRING,
            value: remoteData?.proxyCommand,
            placedID: 6,
            allowedValues: [],
            defaultValue: "",
            category: "Remote",
            disabled: false,
            required: false
          }}
          onChange={(value) =>
            setRemoteData({ ...remoteData, proxyCommand: value } as Remote)
          }
        />

        <PluginVariableView
          variable={{
            name: "Working directory",
            id: "remote-work-dir",
            description: "Specify a working directory on the remote (optional)",
            type: PluginVariableTypes.STRING,
            value: remoteData?.workDir,
            placedID: 7,
            allowedValues: [],
            defaultValue: "",
            category: "Remote",
            disabled: false,
            required: false,
            placeholder: "~/.horus"
          }}
          onChange={(value) =>
            setRemoteData({ ...remoteData, workDir: value } as Remote)
          }
        />

        <PluginVariableView
          variable={{
            name: "Load profile",
            id: "remote-load-profile",
            description:
              "When enabled, tries to load ~/.bashrc or /etc/bash.bashrc when executing commands. This can slow down command execution.",
            type: PluginVariableTypes.BOOLEAN,
            value: remoteData?.loadProfile,
            placedID: 8,
            allowedValues: [],
            defaultValue: false,
            category: "Remote",
            disabled: false,
            required: false
          }}
          onChange={(value) =>
            setRemoteData({ ...remoteData, loadProfile: value } as Remote)
          }
        />
      </div>
    </div>
  );
}
