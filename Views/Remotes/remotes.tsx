// React
import { ChangeEvent, useEffect, useRef, useState } from "react";

// Horus web-server
import { horusPost, horusGet } from "../Utils/utils";

// Horus components
import AppButton from "../Components/appbutton";
import HorusContainer from "../Components/HorusContainer/horus_container";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import BackArrowIcon from "../Components/Toolbar/Icons/BackArrow";
import { HorusFileExplorer } from "../Components/FileExplorer/file_explorer";

// TS type
import { Remote } from "./remote";

// CSS
import "../Components/FlowBuilder/Blocks/block.css";
import "../PluginsManager/plugin_manager.css";
import { useAlert } from "../Components/HorusPrompt/horus_alert";

export default function ConfigRemotes() {
  const [fetchingRemotes, setFetchingRemotes] = useState<boolean>(false);
  const [remotes, setRemotes] = useState<Remote[] | null>(null);

  const [subView, setSubView] = useState<React.ReactNode | null>(null);

  const getRemotes = async () => {
    // if (subView !== null) {
    //   setSubView(null);
    // }

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
      <DetailedRemote key="new-remote" updateRemotes={returnToMainView} />
    );
  };

  const returnToMainView = () => {
    getRemotes();
    setSubView(null);
  };

  useEffect(() => {
    // Retrieve the data
    getRemotes();
  }, []);

  return (
    <div className="overflow-hidden">
      <div className="flex flex-col gap-1 items-center">
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
            <AppButton action={handleNewRemote}>New remote</AppButton>
            <a
              className="app-button text-black text-decoration-none"
              href="https://nbdsoftware.github.io/horus/developer_guide/horusapi/remotes.html"
              target="_blank"
            >
              Learn more about remotes
            </a>
          </div>
        </div>
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
            updateRemotes={returnToMainView}
          />
        )}
      </div>
    </div>
  );
}

type RemoteListProps = {
  remotes: Remote[];
  isLoading: boolean;
  handleSubView(subView: React.ReactNode): void;
  updateRemotes(): void;
};

function RemoteListView(props: RemoteListProps) {
  const { remotes, handleSubView, updateRemotes } = props;

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
              <DetailedRemote remote={remote} updateRemotes={updateRemotes} />
            )
          }
          updateList={updateRemotes}
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

  const horusAlert = useAlert();

  const handleDelete = async () => {
    const data = {
      name: remote.name,
    };

    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify(data);

    const response = await horusPost("/api/remotes/delete", header, body);

    if (!response.ok) {
      await horusAlert("Failed to delete remote");
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
  updateRemotes(): void;
}

function DetailedRemote(props: DetailedRemoteViewProps) {
  const [remoteData, setRemoteData] = useState<Remote | null>(
    props.remote ?? null
  );

  const horusAlert = useAlert();

  const handleSubmit = async () => {
    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify(remoteData);

    const response = await horusPost("/api/remotes/configure", header, body);

    const data = await response.json();

    if (!data.ok) {
      await horusAlert("Failed to configure remote: " + data.msg);
      return;
    }

    props.updateRemotes();
  };

  return (
    <div className="flex flex-col gap-2 h-full w-full justify-center items-center">
      <div className="w-full flex flex-col gap-2">
        <RemoteVariablesView
          remoteData={remoteData}
          setRemoteData={setRemoteData}
        />
      </div>
      <AppButton id="save-remote-button" action={handleSubmit}>
        Save remote
      </AppButton>
    </div>
  );
}

type RemoteVariablesViewProps = {
  remoteData: Remote | null;
  setRemoteData: (remoteData: Remote) => void;
};

function RemoteVariablesView(props: RemoteVariablesViewProps) {
  const { remoteData, setRemoteData } = props;

  const originalName = useRef(remoteData?.name);

  useEffect(() => {
    const saveButton = document.getElementById("save-remote-button")!;
    if (!originalName.current) {
      saveButton.innerHTML = "Save remote";
    } else {
      saveButton.innerHTML = "Update remote";
    }
  }, []);

  const filterNullValue = (
    event: ChangeEvent<HTMLInputElement>,
    setter: (value: string | null) => void
  ) => {
    const value = event.target.value;

    if (value === "") {
      setter(null);
    } else {
      setter(value);
    }
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-row gap-2 flex-wrap">
        <HorusContainer className="p-2 flex-auto">
          <div className="plugin-variable-name">Name</div>
          <input
            id="remote-name"
            className="underlined-variable text-center"
            type="text"
            placeholder="The name of the remote"
            value={remoteData?.name}
            onChange={(event) =>
              filterNullValue(event, (value) => {
                setRemoteData({ ...remoteData, name: value } as Remote);

                if (!originalName.current) {
                  return;
                }

                // Change the "Save remote" button for "Save as new remote"
                const saveButton =
                  document.getElementById("save-remote-button")!;
                if (value !== originalName.current) {
                  saveButton.innerHTML = "Save as a new remote";
                } else {
                  saveButton.innerHTML = "Update remote";
                }
              })
            }
          />
        </HorusContainer>
        <HorusContainer className="p-2 flex-auto">
          <div className="plugin-variable-name">Host</div>
          <input
            id="remote-host"
            className="underlined-variable text-center"
            type="text"
            placeholder="The host of the remote"
            value={remoteData?.host}
            onChange={(event) =>
              filterNullValue(event, (value) =>
                setRemoteData({ ...remoteData, host: value } as Remote)
              )
            }
          />
        </HorusContainer>
        <HorusContainer className="p-2 flex-auto">
          <div className="plugin-variable-name">Username</div>
          <input
            id="remote-username"
            className="underlined-variable text-center"
            type="text"
            placeholder="Your username on the remote"
            value={remoteData?.username}
            onChange={(event) =>
              filterNullValue(event, (value) =>
                setRemoteData({ ...remoteData, username: value } as Remote)
              )
            }
          />
        </HorusContainer>
        <HorusContainer className="p-2 flex-auto">
          <div className="plugin-variable-name">Port</div>
          <input
            id="remote-port"
            className="underlined-variable text-center"
            type="text"
            placeholder="The port of the remote"
            value={remoteData?.port}
            onChange={(event) =>
              filterNullValue(event, (value) =>
                setRemoteData({ ...remoteData, port: value } as Remote)
              )
            }
          />
        </HorusContainer>
      </div>
      <div className="flex flex-row gap-2 flex-wrap">
        <HorusContainer className="p-2 flex-1 flex flex-col justify-center min-w-[25rem] h-full">
          <div className="plugin-variable-name">Password</div>
          <input
            id="remote-password"
            className="underlined-variable text-center"
            type="password"
            placeholder="Optional if using key file"
            aria-hidden
            // Prevent browser from autofilling password
            // Disable autocomplete
            autoComplete="new-password"
            value={remoteData?.password}
            onChange={(event) =>
              filterNullValue(event, (value) =>
                setRemoteData({ ...remoteData, password: value } as Remote)
              )
            }
          />
        </HorusContainer>
        <HorusContainer className="p-2 flex-1 min-w-[25rem]">
          <div className="plugin-variable-name">Key file</div>
          <div className="flex flex-row gap-2 w-full items-center">
            <input
              id="remote-key-path"
              className="underlined-variable text-center"
              type="text"
              placeholder="Optional if using password"
              value={remoteData?.keyPath}
              onChange={(event) =>
                filterNullValue(event, (value) =>
                  setRemoteData({ ...remoteData, keyPath: value } as Remote)
                )
              }
            />
            <HorusFileExplorer
              onFileConfirm={(path) =>
                setRemoteData({ ...remoteData, keyPath: path } as Remote)
              }
              onFileSelect={() => {}}
            >
              <div className="w-20 text-black">Browse...</div>
            </HorusFileExplorer>
          </div>
        </HorusContainer>
      </div>
      <div className="flex flex-row gap-2 flex-wrap">
        <HorusContainer className="p-2 flex-1 min-w-[25rem]">
          <div className="plugin-variable-name">ProxyCommand</div>
          <input
            id="remote-proxy-command"
            className="underlined-variable text-center"
            type="text"
            placeholder="A proxy command to use (optional)"
            value={remoteData?.proxyCommand}
            onChange={(event) =>
              filterNullValue(event, (value) =>
                setRemoteData({ ...remoteData, proxyCommand: value } as Remote)
              )
            }
          />
        </HorusContainer>
        <HorusContainer className="p-2 flex-1 min-w-[25rem]">
          <div className="plugin-variable-name">Working directory</div>
          <input
            id="remote-work-dir"
            className="underlined-variable text-center"
            type="text"
            placeholder="Specify a working directory on the remote (optional)"
            value={remoteData?.workDir}
            onChange={(event) =>
              filterNullValue(event, (value) =>
                setRemoteData({ ...remoteData, workDir: value } as Remote)
              )
            }
          />
        </HorusContainer>
      </div>
    </div>
  );
}
