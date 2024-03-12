import { useEffect, useMemo, useState } from "react";
import { horusGet, horusPost } from "../Utils/utils";
import { BlurredModal } from "../Components/reusable";
import { createPortal } from "react-dom";
import Logo from "../Components/logo";
import HorusContainer from "../Components/HorusContainer/horus_container";

type Database = {
  users: UsersDatabase[];
  flows: FlowsDatabase[];
};

type UsersDatabase = {
  id: number;
  activated: boolean;
  admin: boolean;
  group: string;
  last_login: string;
  maxFlows: number;
  maxStorage: number;
  maxTime: number;
  registration_date: string;
  email: string;
  [key: string]: any;
};

type FlowsDatabase = {
  deleted: boolean;
  flow_id: string;
  id: string;
  size: number;
  time: number;
};

export function AdminTools() {
  const [database, setDatabase] = useState<Database | null>(null);
  const [showUsers, setShowUsers] = useState<boolean>(true);

  const getDatabase = async () => {
    const response = await horusGet("/users/admintools/data");
    if (!response) {
      alert("An error occurred. Try again later.");
      return;
    }
    const data = await response.json();

    setDatabase(data);
  };

  useEffect(() => {
    getDatabase();
  }, []);

  const appName = "Admin Tools";

  return (
    <>
      <HorusContainer
        className="sticky-app-header flex flex-row flex-wrap items-center justify-between px-2 w-full bg-white"
        style={{
          position: "sticky",
          zIndex: 200,
          top: "0",
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          borderRadius: "0",
          width: "100%",
        }}
      >
        <div>
          <Logo className="h-16" />
        </div>
        <div className="flex justify-center items-center w-full font-semibold absolute mx-auto">
          {appName}
        </div>
      </HorusContainer>
      <div className="flex flex-col justify-center items-center">
        <div className="flex flex-row flex-wrap gap-2 justify-between w-full">
          <div
            className="flex flex-row gap-2"
            style={{
              margin: "1rem",
            }}
          >
            <h3
              className="flow-title"
              style={{
                cursor: "pointer",
                opacity: showUsers ? 1 : 0.5,
              }}
              onClick={() => setShowUsers(true)}
            >
              Users Database
            </h3>
            <h3
              className="flow-title"
              style={{
                cursor: "pointer",
                opacity: !showUsers ? 1 : 0.5,
              }}
              onClick={() => setShowUsers(false)}
            >
              Flows Database
            </h3>
          </div>
        </div>
        {database &&
          (showUsers ? (
            <UsersTableView users={database.users} />
          ) : (
            <FlowsTableView flows={database.flows} />
          ))}
      </div>
    </>
  );
}

function UsersTableView({ users }: { users: UsersDatabase[] }) {
  const [modalContent, setModalContent] = useState<React.ReactNode>(null);
  const [modalOpened, setModalOpened] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Compute the current page users
  const usersPerPage = 10;
  const currentUsers = useMemo(() => {
    return users.slice(
      currentPage * usersPerPage,
      (currentPage + 1) * usersPerPage
    );
  }, [users, currentPage]);

  const totalPages = useMemo(() => {
    return Math.floor(users.length / usersPerPage) + 1;
  }, [users]);

  // Attach the modal to the body
  useEffect(() => {
    const modal = document.createElement("div");
    modal.id = "modal-moredata";
    document.body.appendChild(modal);
    return () => {
      document.body.removeChild(modal);
    };
  }, []);

  return (
    <div
      style={{
        maxWidth: "100vw",
        overflowX: "auto",
      }}
    >
      <table className="styled-table">
        <thead>
          <tr>
            <th>User ID</th>

            <th>Email</th>
            <th>Registration date</th>
            <th>Last login</th>
            <th>Activated</th>
            <th>Group</th>
            <th>Admin</th>
            <th>Other data</th>
            <th>Max Flows</th>
            <th>Max Storage</th>
            <th>Max horus</th>
            <th>Apply quota</th>
          </tr>
        </thead>
        <tbody>
          {currentUsers.map((user) => (
            <RowUserView
              user={user}
              setModalContent={setModalContent}
              setModalOpened={setModalOpened}
            />
          ))}
        </tbody>
      </table>
      <div className="flex flex-row gap-2 m-2">
        <button
          className="app-button"
          onClick={() => {
            if (currentPage > 0) {
              setCurrentPage(currentPage - 1);
            }
          }}
        >
          Previous
        </button>
        <div className="app-button">
          {currentPage + 1} / {totalPages}
        </div>
        <button
          className="app-button"
          onClick={() => {
            if (currentPage < Math.floor(users.length / usersPerPage)) {
              setCurrentPage(currentPage + 1);
            }
          }}
        >
          Next
        </button>
      </div>
      {modalOpened &&
        createPortal(
          <div className="m-2">
            <BlurredModal
              show={modalOpened}
              onHide={() => {
                setModalOpened(false);
              }}
            >
              {modalContent}
            </BlurredModal>
          </div>,
          document.getElementById("modal-moredata") as HTMLDivElement
        )}
    </div>
  );
}

function RowUserView({
  user,
  setModalContent,
  setModalOpened,
}: {
  user: UsersDatabase;
  setModalContent: (content: React.ReactNode) => void;
  setModalOpened: (opened: boolean) => void;
}) {
  const [newUserQuota, setNewUserQuota] = useState<UsersDatabase>({
    ...user,
  });

  const updateUserQuota = async () => {
    const newQuotaToSend = JSON.stringify(newUserQuota);

    const response = await horusPost(
      `/users/admintools/modifyuser`,
      null,
      newQuotaToSend
    );

    if (!response) {
      alert("An error occurred. Try again later.");
      return;
    }

    const data = await response.json();

    if (data.error) {
      alert(data.msg);
      return;
    }

    alert("User quota updated!");
  };

  return (
    <tr>
      <td>{user.id}</td>
      <td>{user.email}</td>
      <td>
        <div className="w-[150px] overflow-x-scroll">
          {user.registration_date}
        </div>
      </td>
      <td>
        <div className="w-[150px] overflow-x-scroll">{user.last_login}</div>
      </td>
      <td>{user.activated ? "Yes" : "No"}</td>
      <td>{user.group ?? "None"}</td>
      <td>{user.admin ? "Yes" : "No"}</td>
      <td>
        <button
          className="app-button"
          onClick={() => {
            setModalContent(
              <pre>
                {
                  // For each field, show the value
                  Object.keys(user).map((key) => {
                    return `${key}: ${user[key]}\n`;
                  })
                }
              </pre>
            );
            setModalOpened(true);
          }}
        >
          View
        </button>
      </td>
      <td>
        <input
          type="number"
          value={newUserQuota.maxFlows}
          onChange={(e) => {
            setNewUserQuota({
              ...user,
              maxFlows: parseInt(e.target.value),
            });
          }}
        />
      </td>
      <td>
        <input
          type="number"
          value={newUserQuota.maxStorage}
          onChange={(e) => {
            setNewUserQuota({
              ...user,
              maxStorage: parseInt(e.target.value),
            });
          }}
        />
      </td>
      <td>
        <input
          type="number"
          value={newUserQuota.maxTime}
          onChange={(e) => {
            setNewUserQuota({
              ...user,
              maxTime: parseInt(e.target.value),
            });
          }}
        />
      </td>
      <td>
        <button
          className="app-button"
          onClick={() => {
            updateUserQuota();
          }}
        >
          Apply
        </button>
      </td>
    </tr>
  );
}

function FlowsTableView({ flows }: { flows: FlowsDatabase[] }) {
  const [currentPage, setCurrentPage] = useState<number>(0);

  // Compute the current page users
  const flowsPerPage = 10;
  const currentFlows = useMemo(() => {
    return flows.slice(
      currentPage * flowsPerPage,
      (currentPage + 1) * flowsPerPage
    );
  }, [flows, currentPage]);

  const totalPages = useMemo(() => {
    return Math.floor(flows.length / flowsPerPage) + 1;
  }, [flows]);

  return (
    <div>
      <table className="styled-table">
        <thead>
          <tr>
            <th>Flow ID</th>
            <th>User ID</th>
            <th>Size</th>
            <th>Time</th>
            <th>Deleted</th>
          </tr>
        </thead>
        <tbody>
          {currentFlows.map((flow) => (
            <tr>
              <td>{flow.flow_id}</td>
              <td>{flow.id}</td>
              <td>{flow.size}</td>
              <td>{flow.time}</td>
              <td>{flow.deleted ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-row gap-2 mt-2">
        <button
          className="app-button"
          onClick={() => {
            if (currentPage > 0) {
              setCurrentPage(currentPage - 1);
            }
          }}
        >
          Previous
        </button>
        <div className="app-button">
          {currentPage + 1} / {totalPages}
        </div>
        <button
          className="app-button"
          onClick={() => {
            if (currentPage < Math.floor(flows.length / flowsPerPage)) {
              setCurrentPage(currentPage + 1);
            }
          }}
        >
          Next
        </button>
      </div>
    </div>
  );
}
