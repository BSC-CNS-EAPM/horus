import { useEffect, useState } from "react";
import { horusPost, horusGet } from "../Utils/utils";
import { HorusModal } from "../Components/reusable";
import NBDButton from "../Components/nbdbutton";

import "../Components/FlowBuilder/block.css";
import "../PluginsManager/plugin_manager.css";

export default function ConfigRemotes() {
  const [remotes, setRemotes] = useState([]);

  const getRemotes = async () => {
    const response = await horusGet("/remotes/list");

    const data = await response.json();

    const remotes = data.map((remote: any) => {
      return {
        name: remote.name,
        host: remote.host,
        username: remote.username,
        password: remote.password,
        port: remote.port,
        keyPath: remote.keyPath,
        proxyCommand: remote.proxyCommand,
        workDir: remote.workDir,
      };
    });

    setRemotes(remotes);
  };

  const [showNewRemote, setShowNewRemote] = useState(false);

  useEffect(() => {
    // Retrieve the data
    getRemotes();
  }, []);

  const [editRemoteData, setEditRemoteData] = useState(null);

  const handleEdit = (remote: any) => {
    setEditRemoteData(remote);
    setShowNewRemote(true);
  };

  const hideModal = () => {
    setShowNewRemote(false);
    setEditRemoteData(null);
  };

  return (
    <div className="root-plugin-container overflow-hidden">
      <div className="flex flex-col gap-1 items-center">
        <div className="plugin-manager-title flex">
          <h1>Remotes</h1>
          <div className="flex flex-row gap-2 mr-2">
            <NBDButton action={() => setShowNewRemote(true)}>
              New remote
            </NBDButton>
          </div>
        </div>
        <div>
          <NewRemote
            shown={showNewRemote}
            hidemodal={hideModal}
            updateList={getRemotes}
            data={editRemoteData}
          />
          {remotes?.map((remote) => (
            <RemoteView
              remote={remote}
              updateList={getRemotes}
              handleEdit={handleEdit}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface RemoteViewProps {
  remote: {
    name: string;
    host: string;
    username: string;
    password: string;
    port: string;
    keyPath: string;
    proxyCommand: string;
  };
  handleEdit(remote: any): void;
  updateList(): void;
}

function RemoteView(props: RemoteViewProps) {
  const remote = props.remote;

  const handleDelete = async () => {
    const data = {
      name: remote.name,
    };

    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify(data);

    const response = await horusPost("/remotes/delete", header, body);

    if (response.ok) {
      alert("Remote deleted successfully");
    } else {
      alert("Failed to delete remote");
    }

    props.updateList();
  };

  const handleEdit = async () => {
    props.handleEdit(remote);
  };

  return (
    <div
      className="plugin-variable flex flex-col gap-1 align-middle items-center"
      style={{
        width: "25rem",
        border: "1px solid black",
      }}
    >
      <div className="plugin-variable-name">{remote.name}</div>
      <div className="flex flex-row gap-1">
        <NBDButton action={handleEdit}>Edit</NBDButton>
        <NBDButton action={handleDelete}>Delete</NBDButton>
      </div>
    </div>
  );
}

interface NewRemoteProps {
  updateList(): void;
  shown: boolean;
  hidemodal(): void;
  data?: {
    name: string;
    host: string;
    username: string;
    password: string;
    port: string;
    keyPath: string;
    proxyCommand: string;
    workDir: string;
  };
}

function NewRemote(props: NewRemoteProps) {
  const [name, setName] = useState(null);
  const [host, setHost] = useState(null);
  const [username, setUsername] = useState(null);
  const [password, setPassword] = useState(null);
  const [port, setPort] = useState(null);
  const [keyPath, setKeyPath] = useState(null);
  const [proxyCommand, setProxyCommand] = useState(null);
  const [workDir, setWorkDir] = useState(null);

  // Use useEffect to update the state whenever props.data changes
  useEffect(() => {
    setName(props.data?.name);
    setHost(props.data?.host);
    setUsername(props.data?.username);
    setPassword(props.data?.password);
    setPort(props.data?.port);
    setKeyPath(props.data?.keyPath);
    setProxyCommand(props.data?.proxyCommand);
    setWorkDir(props.data?.workDir);
  }, [props.data]);

  const handleSubmit = async () => {
    const newConfig = {
      name: name,
      host: host,
      username: username,
      password: password,
      port: port,
      keyPath: keyPath,
      proxyCommand: proxyCommand,
      workDir: workDir,
    };

    const header = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const body = JSON.stringify(newConfig);

    const response = await horusPost("/remotes/configure", header, body);

    const data = await response.json();

    if (!data.ok) {
      alert("Failed to configure remote: " + data.msg);
      return;
    }

    props.hidemodal();
    props.updateList();
  };

  const openFilePicker = async () => {
    const result = await horusGet("/openfile");

    const data = await result.json();

    setKeyPath(data.path);
  };

  return (
    <div>
      <HorusModal
        header="Setup remote"
        body={
          <div>
            <div>
              <div className="plugin-variable">
                <div className="plugin-variable-name">Remote name</div>
                <input
                  className="plugin-variable-value text-center"
                  type="text"
                  placeholder="The name of the remote"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div className="plugin-variable">
                <div className="plugin-variable-name">Host</div>
                <input
                  className="plugin-variable-value text-center"
                  type="text"
                  placeholder="The host of the remote"
                  value={host}
                  onChange={(event) => setHost(event.target.value)}
                />
              </div>
              <div className="plugin-variable">
                <div className="plugin-variable-name">Username</div>
                <input
                  className="plugin-variable-value text-center"
                  type="text"
                  placeholder="Your username on the remote"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                />
              </div>
              <div className="plugin-variable">
                <div className="plugin-variable-name">Password</div>
                <input
                  className="plugin-variable-value text-center"
                  type="password"
                  placeholder="Optional if using key file"
                  aria-hidden
                  // Prevent browser from autofilling password
                  // Disable autocomplete
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="plugin-variable">
                <div className="plugin-variable-name">Port</div>
                <input
                  className="plugin-variable-value text-center"
                  type="text"
                  placeholder="The port of the remote"
                  value={port}
                  onChange={(event) => setPort(event.target.value)}
                />
              </div>
              <div className="plugin-variable">
                <div className="plugin-variable-name">Key file</div>
                <div className="flex flex-col gap-1 w-full align-items-center">
                  <input
                    className="plugin-variable-value text-center"
                    type="text"
                    placeholder="Optional if using password"
                    value={keyPath}
                    onChange={(event) => setKeyPath(event.target.value)}
                  />
                  <NBDButton action={openFilePicker}>Select file...</NBDButton>
                </div>
              </div>
              <div className="plugin-variable">
                <div className="plugin-variable-name">ProxyCommand</div>
                <input
                  className="plugin-variable-value text-center"
                  type="text"
                  placeholder="A proxy command to use (optional)"
                  value={proxyCommand}
                  onChange={(event) => setProxyCommand(event.target.value)}
                />
              </div>
              <div className="plugin-variable">
                <div className="plugin-variable-name">Working directory</div>
                <input
                  className="plugin-variable-value text-center"
                  type="text"
                  placeholder="Specify a working directory on the remote (optional)"
                  value={workDir}
                  onChange={(event) => setWorkDir(event.target.value)}
                />
              </div>
            </div>
          </div>
        }
        footer={
          <div className="flex flex-row gap-1">
            <NBDButton action={handleSubmit}>Save</NBDButton>
            <NBDButton action={() => props.hidemodal()}>Close</NBDButton>
          </div>
        }
        onHide={() => {
          props.hidemodal();
        }}
        show={props.shown}
      />
    </div>
  );
}
