// React imports
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// 3rd party libraries
import { AgGridReact } from "ag-grid-react";

// Horus utils
import { fetchDesktop, horusDelete, horusGet, horusPost } from "../Utils/utils";

// Horus components
import HorusContainer from "../Components/HorusContainer/horus_container";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import AppButton from "../Components/appbutton";
import { BlurredModal } from "../Components/reusable";
import { SettingsView, fetchSettings } from "../Settings/settings";
import { PluginManager } from "../PluginsManager/plugin_manager";
import { HorusTable } from "../Components/TablePlot/horustable";

// Icons
import Logo from "../Components/logo";
import UserIcon from "../Components/Toolbar/Icons/User";
import PluginsIcon from "../Components/Toolbar/Icons/Plugins";
import SettingsIcon from "../Components/Toolbar/Icons/Settings";
import CenterView from "../Components/Toolbar/Icons/CenterView";
import NewFlowIcon from "../Components/Toolbar/Icons/New";
import LogFile from "../Components/Toolbar/Icons/LogFile";
import TrashIcon from "../Components/Toolbar/Icons/Trash";

// Types
import { Block, PluginPage } from "../Components/FlowBuilder/flow.types";
import { useAlert } from "../Components/HorusPrompt/horus_alert";
import { HorusLazyLog } from "../Components/HorusLazyLog/HorusLazyLog";
import { SearchComponent } from "@/Components/Search/Search";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

type Database = {
  users: UsersDatabase[];
  flows: FlowsDatabase[];
  groups: GroupsDatabase[];
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

type GroupsDatabase = {
  group: string;
  blocks: string;
  extensions: string;
};

type FlowsDatabase = {
  deleted: boolean;
  flow_id: string;
  id: string;
  size: number;
  time: number;
};

type AdminContextType = {
  setCurrentView: (v: ReactNode) => void;
  // showModalWithView: (v: ReactNode) => void;
};

const AdminContext = createContext<AdminContextType | null>(null);
const queryClient = new QueryClient();

export function BaseAdminToolsView() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminTools />
    </QueryClientProvider>
  );
}

function AdminTools() {
  const [currentView, _setCurrentView] = useState<ReactNode>(
    <UsersTableView />,
  );

  const setCurrentView = (v: ReactNode) => {
    _setCurrentView(v);
  };

  useEffect(() => {
    // Fetch horus internal
    fetchDesktop();
    fetchSettings();
  }, []);

  return (
    <AdminContext.Provider value={{ setCurrentView }}>
      <TopBar />
      <div className="flex flex-row gap-0 w-available admin-current-view">
        <Sidebar />
        <div className="overflow-y-auto w-full">{currentView}</div>
      </div>
    </AdminContext.Provider>
  );
}

function UsersTableView() {
  const [database, setDatabase] = useState<Database | null>(null);

  const horusAlert = useAlert();

  const getDatabase = async () => {
    const response = await horusGet("/users/admintools/data");
    if (!response) {
      await horusAlert("An error occurred. Try again later.");
      return;
    }
    const data = await response.json();

    setDatabase(data);
  };

  useEffect(() => {
    getDatabase();
  }, []);

  if (!database) {
    return <_Loading />;
  }

  const availableGroups = database.groups.map((g) => g.group);

  return (
    <_UserTable
      users={database.users}
      groups={availableGroups}
      getDatabase={getDatabase}
    />
  );
}

function _UserTable({
  users,
  groups,
  getDatabase,
}: {
  users: UsersDatabase[];
  groups: string[];
  getDatabase: () => void;
}) {
  const horusAlert = useAlert();
  const updateUser = async (newUser: UsersDatabase) => {
    const newQuotaToSend = JSON.stringify(newUser);

    const response = await horusPost(
      `/users/admintools/modifyuser`,
      null,
      newQuotaToSend,
    );

    if (!response) {
      await horusAlert("An error occurred. Try again later.");
      return;
    }

    const data = await response.json();

    if (!data.ok) {
      await horusAlert(data.msg);
      getDatabase();
    }
  };

  const columns = useMemo((): any[] => {
    const editableColumns = [
      "activated",
      "group",
      "admin",
      "maxFlows",
      "maxTemplates",
      "maxStorage",
      "maxTime",
    ];

    const sampleUser = users[0]!;

    return Object.keys(sampleUser).map((k) => {
      return {
        field: k,
        filter: true,
        editable: editableColumns.includes(k),
        cellEditor: k === "group" ? "agSelectCellEditor" : undefined,
        cellEditorParams:
          k === "group"
            ? {
                values: groups,
              }
            : undefined,
        valueFormatter:
          k === "group"
            ? (params: any) => {
                if (!params.value) {
                  return "default";
                }

                return params.value;
              }
            : undefined,
      };
    });
  }, [users, groups]);

  const editCell = (e: any) => {
    // Only update if its different
    if (e.newValue === undefined || e.newValue === e.oldValue) {
      return;
    }

    updateUser(e.data);
  };

  const tableRef = useRef<AgGridReact | null>(null);

  return (
    <HorusTable
      allowDownload={{
        filename: "users.csv",
      }}
      ref={tableRef}
      columnDefs={columns}
      rows={users}
      onCellEdit={editCell}
    />
  );
}

function FlowsTableView() {
  const [database, setDatabase] = useState<Database | null>(null);
  const horusAlert = useAlert();

  const getDatabase = async () => {
    const response = await horusGet("/users/admintools/data");
    if (!response) {
      await horusAlert("An error occurred. Try again later.");
      return;
    }
    const data = await response.json();

    setDatabase(data);
  };

  useEffect(() => {
    // Get the database
    getDatabase();
  }, []);

  const cols = useMemo(() => {
    if (!database) {
      return [];
    }

    const sampleFlow = database.flows[0]!;

    if (!sampleFlow) {
      return [];
    }

    return Object.keys(sampleFlow).map((f) => {
      return {
        field: f,
        filter: true,
        flex: 1,
      };
    });
  }, [database]);

  if (!database) {
    return <_Loading />;
  }

  return <HorusTable columnDefs={cols} rows={database.flows} />;
}

function HorusLogs() {
  const logsInterval = useRef<Timer | null>(null);
  const [logs, setLogs] = useState<string>("Loading...");

  const getLogs = useCallback(async () => {
    const response = await horusGet("/users/admintools/getlogs");
    const logsText = await response.text();
    setLogs(logsText);

    // Clean the previous interval
    logsInterval.current && clearInterval(logsInterval.current);
    logsInterval.current = null;

    logsInterval.current = setInterval(async () => {
      const response = await horusGet("/users/admintools/getlogs");
      const logsText = await response.text();
      setLogs(logsText);
    }, 10000);
  }, []);

  useEffect(() => {
    // Get the first logs
    getLogs();

    return () => {
      logsInterval.current && clearInterval(logsInterval.current);
      logsInterval.current = null;
    };
  }, [getLogs]);

  return <HorusLazyLog logText={logs} filename="horus-logs.log" />;
}

function Sidebar() {
  return (
    <div className="border-r-2">
      <div className="h-full w-56 flex flex-col gap-2 my-2 mx-2">
        <ManageUsers />
        <ManageGroups />
        <ManageFlows />
        <ManageLogs />
        <ManagePlugins />
        <ManageSettings />
      </div>
    </div>
  );
}

function ManageUsers() {
  const adminContext = useContext(AdminContext);

  return (
    <HorusContainer
      className="zoom-on-hover"
      onClick={() => {
        adminContext?.setCurrentView(<UsersTableView />);
      }}
    >
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full w-[150px]">
        <UserIcon className="w-6 h-6 icon" />
        Users
      </div>
    </HorusContainer>
  );
}

function ManageLogs() {
  const adminContext = useContext(AdminContext);

  return (
    <HorusContainer
      className="zoom-on-hover"
      onClick={() => {
        adminContext?.setCurrentView(<HorusLogs />);
      }}
    >
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full w-[150px]">
        <LogFile className="w-6 h-6 icon" />
        Logs
      </div>
    </HorusContainer>
  );
}

function ManageFlows() {
  const adminContext = useContext(AdminContext);

  return (
    <HorusContainer
      className="zoom-on-hover"
      onClick={() => {
        adminContext?.setCurrentView(<FlowsTableView />);
      }}
    >
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full w-[150px]">
        <NewFlowIcon className="w-6 h-6 icon" />
        Flows
      </div>
    </HorusContainer>
  );
}

function TopBar() {
  const appName = "Admin Tools";

  return (
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
        height: "5rem",
      }}
    >
      <div>
        <Logo className="h-16" />
      </div>
      <div className="flex justify-center items-center w-full font-semibold absolute mx-auto">
        {appName}
      </div>
    </HorusContainer>
  );
}

function ManagePlugins() {
  const adminContext = useContext(AdminContext);

  return (
    <HorusContainer
      className="zoom-on-hover"
      onClick={() => {
        // Set the developmentMode to true artifically in order to show the "reload plugins" button
        // @ts-ignore
        window.horusSettings["developmentMode"] = {
          value: true,
        };

        adminContext?.setCurrentView(<PluginManager />);
      }}
    >
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full w-[150px]">
        <PluginsIcon className="w-6 h-6 icon" />
        Plugins
      </div>
    </HorusContainer>
  );
}

function ManageSettings() {
  const adminContext = useContext(AdminContext);

  return (
    <HorusContainer
      className="zoom-on-hover"
      onClick={() => {
        adminContext?.setCurrentView(<SettingsView forAdmin={true} />);
      }}
    >
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full w-[150px]">
        <SettingsIcon className="w-6 h-6 icon" />
        App settings
      </div>
    </HorusContainer>
  );
}

function ManageGroups() {
  const adminContext = useContext(AdminContext);

  return (
    <HorusContainer
      className="zoom-on-hover"
      onClick={() => {
        adminContext?.setCurrentView(<GroupDatabaseView />);
      }}
    >
      <div className="flex flex-row gap-2 justify-stretch items-center font-semibold h-full w-[150px]">
        <CenterView className="w-6 h-6 icon" />
        Group settings
      </div>
    </HorusContainer>
  );
}

function GroupDatabaseView() {
  const [database, setDatabase] = useState<Database | null>(null);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [createGroupText, setCreateGroupText] = useState("");
  const horusAlert = useAlert();

  const getDatabase = async () => {
    const response = await horusGet("/users/admintools/data");
    if (!response) {
      await horusAlert("An error occurred. Try again later.");
      return;
    }
    const data = await response.json();

    setDatabase(data);
  };

  const createGroup = async (g: string) => {
    setCreatingGroup(true);
    try {
      const response = await horusPost(
        "/users/admintools/add_group",
        null,
        JSON.stringify({ group: g }),
      );

      const data = await response.json();

      if (data.ok) {
        getDatabase();
      } else {
        await horusAlert(data.msg);
      }
    } finally {
      setCreatingGroup(false);
    }
  };

  const deleteGroup = async (g: string) => {
    const response = await horusDelete({
      url: "/users/admintools/modify_group",
      body: { group: g },
    });

    const data = await response.json();

    if (data.ok) {
      await horusAlert(data.msg);
      getDatabase();
    } else {
      await horusAlert(data.msg);
    }
  };

  useEffect(() => {
    getDatabase();
  }, []);

  const columns = useCallback(() => {
    if (!database || database.groups.length < 1) {
      return [];
    }
    const sampleGroup = database.groups[0]!;
    const groupsCols: any[] = Object.keys(sampleGroup).map((c) => {
      return {
        field: c,
        flex: 1,
        filter: true,
        valueFormatter:
          c !== "group"
            ? (params: any) => {
                if (!params.value) {
                  return "None";
                }

                const parsed = JSON.parse(params.value);

                if (parsed) {
                  return `${parsed.lenght}`;
                }

                return params.value;
              }
            : undefined,
        cellRenderer:
          c !== "group"
            ? (params: any) => {
                if (params.colDef.field === "blocks") {
                  return (
                    <div className="flex w-full h-full items-center justify-start">
                      <ModifyGroupBlocks
                        group={params.data.group}
                        blocks={params.value}
                        getDatabase={getDatabase}
                      />
                    </div>
                  );
                } else {
                  return (
                    <div className="flex w-full h-full items-center justify-start">
                      <ModifyGroupPages
                        group={params.data.group}
                        pages={params.value}
                        getDatabase={getDatabase}
                      />
                    </div>
                  );
                }
              }
            : undefined,
      };
    });
    //  Add the delete column
    groupsCols.push({
      field: "Delete",
      cellRenderer: (params: any) => {
        return (
          <div
            className="w-full h-full flex justify-center items-center"
            onClick={() => {
              deleteGroup(params.data.group);
            }}
          >
            <TrashIcon style={{ color: "red" }} />
          </div>
        );
      },
    });

    return groupsCols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [database]);

  if (!database || creatingGroup) {
    return <_Loading />;
  }

  return (
    <div className="flex flex-row admin-current-view">
      <div className="flex flex-col gap-2 w-full">
        <div className="flex flex-row gap-2 px-2 pt-2 w-full">
          <input
            placeholder="Input a new group name..."
            className="plugin-variable-value border-2 rounded-md"
            value={createGroupText}
            onChange={(e) => {
              setCreateGroupText(e.target.value);
            }}
          />
          <AppButton
            className="flex text-center items-center justify-center"
            action={() => {
              createGroup(createGroupText);
            }}
          >
            Create
          </AppButton>
        </div>
        <HorusTable columnDefs={columns()} rows={database.groups} />
      </div>
    </div>
  );
}

function ModifyGroupBlocks({
  group,
  blocks,
  getDatabase,
}: {
  group: string;
  blocks: string;
  getDatabase: () => void;
}) {
  const [showModal, setShowModal] = useState(false);

  const currentBlocks = blocks ? JSON.parse(blocks) : [];

  return (
    <>
      <div
        className="w-full"
        onClick={() => {
          setShowModal(true);
        }}
      >
        {currentBlocks.length} blocks
      </div>
      <BlurredModal
        maxContentSize={{
          width: "90vw",
        }}
        overRoot
        show={showModal}
        onHide={() => {
          setShowModal(false);
        }}
      >
        <BlockViewModify
          group={group}
          blocks={blocks}
          getDatabase={getDatabase}
        />
      </BlurredModal>
    </>
  );
}

export function BlockViewModify(props: {
  group: string;
  blocks: string;
  getDatabase: () => void;
}) {
  const { group, blocks, getDatabase } = props;

  const [editedBlocks, setEditedBlocks] = useState<Block[]>([]);
  const [filteredBlocks, setFilteredBlocks] = useState<Block[]>([]);
  const [currentFilter, setCurrentFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const [allBlocks, setAllBlocks] = useState<Block[]>([]);

  const getBlocks = async () => {
    setLoading(true);

    horusGet("/api/plugins/listblocks")
      .then((res) => res.json())
      .then((data) => setAllBlocks(data.blocks))
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getBlocks();
  }, []);
  const horusAlert = useAlert();

  const modifyGroup = useCallback(async () => {
    const response = await horusPost(
      "/users/admintools/modify_group",
      null,
      JSON.stringify({
        group,
        blockIDs: editedBlocks.map((b) => b.id),
      }),
    );

    const data = await response.json();

    if (!data.ok) {
      await horusAlert(data.msg);
    } else {
      getDatabase();
    }
  }, [editedBlocks, group, getDatabase]);

  useEffect(() => {
    setFilteredBlocks(allBlocks.filter((b) => b.id.includes(currentFilter)));
  }, [currentFilter, allBlocks]);

  useEffect(() => {
    const parsedBlocks: string[] | null = JSON.parse(blocks);

    if (parsedBlocks) {
      const presentBlocks: Block[] = allBlocks.filter((b) => {
        return parsedBlocks.find((p) => {
          return p === b.id;
        });
      });

      setEditedBlocks(presentBlocks);
    } else {
      setEditedBlocks([]);
    }
  }, [blocks, allBlocks]);

  return (
    <div
      className="plugin-variable-value p-4"
      style={{
        height: "70vh",
        overflow: "auto",
      }}
    >
      <div className="flex flex-row gap-2 w-full">
        <SearchComponent
          className="w-full"
          placeholder="Search for a block"
          onChange={(e) => {
            setCurrentFilter(e.target.value);
          }}
          showIcon={false}
        />
        <AppButton
          action={() => {
            // Create an array of filtered blocks that are not already in the set
            const blocksToAdd = filteredBlocks.filter(
              (f) => !editedBlocks.find((e) => e.id === f.id),
            );

            // Concatenate the unique filtered blocks to the current edited blocks
            setEditedBlocks([...editedBlocks, ...blocksToAdd]);
          }}
        >
          All
        </AppButton>
        <AppButton
          action={() => {
            setEditedBlocks((editedBlocks) => {
              return editedBlocks.filter(
                (b) => !filteredBlocks.find((f) => f.id === b.id),
              );
            });
          }}
        >
          None
        </AppButton>
        <AppButton action={modifyGroup}>Apply</AppButton>
      </div>
      {filteredBlocks.length === 0 ? (
        <div className="grid place-items-center mt-8">
          {loading ? "Loading..." : "No blocks"}
        </div>
      ) : (
        <div className="w-full overflow-auto min-h-12 mt-2">
          {filteredBlocks.map((filteredB) => (
            <div
              key={filteredB.id}
              className="flex flex-row items-center justify-between border-t-2"
              style={{
                gap: "1rem",
                textAlign: "left",
                paddingInline: "0.5rem",
              }}
            >
              <input
                style={{ width: "1rem" }}
                type="checkbox"
                checked={
                  editedBlocks?.find((b) => b.id === filteredB.id) !== undefined
                }
                onChange={(e) =>
                  setEditedBlocks(
                    e.target.checked
                      ? [...(editedBlocks ?? []), filteredB]
                      : (editedBlocks ?? []).filter(
                          (blo: Block) => blo.id !== filteredB.id,
                        ),
                  )
                }
              />
              <div className="w-full gap-2 items-start py-1">
                {filteredB.id}{" "}
                <span className="text-xs text-muted">
                  {filteredB.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModifyGroupPages({
  group,
  pages,
  getDatabase,
}: {
  group: string;
  pages: string;
  getDatabase: () => void;
}) {
  const [showModal, setShowModal] = useState(false);
  const currentPages = pages ? JSON.parse(pages) : [];

  return (
    <>
      <div
        className="w-full"
        onClick={() => {
          setShowModal(true);
        }}
      >
        {currentPages.length} extensions
      </div>
      <BlurredModal
        overRoot
        show={showModal}
        onHide={() => {
          setShowModal(false);
        }}
        maxContentSize={{
          width: "90vw",
        }}
      >
        <ExtensionViewModify
          group={group}
          pages={pages}
          getDatabase={getDatabase}
        />
      </BlurredModal>
    </>
  );
}

export function ExtensionViewModify(props: {
  group: string;
  pages: string;
  getDatabase: () => void;
}) {
  const { group, pages, getDatabase } = props;
  const [allPages, setAllPages] = useState<PluginPage[]>([]);
  const [loading, setLoading] = useState(true);

  const getPages = async () => {
    setLoading(true);
    horusGet("/api/plugins/listpages")
      .then((res) => res.json())
      .then((data) => setAllPages(data.pages))
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    getPages();
  }, []);
  const [editedPages, setEditedPages] = useState<PluginPage[]>([]);
  const [filteredPages, setFilteredPages] = useState<PluginPage[]>([]);
  const [currentFilter, setCurrentFilter] = useState("");
  const horusAlert = useAlert();

  const modifyGroup = useCallback(async () => {
    const response = await horusPost(
      "/users/admintools/modify_group",
      null,
      JSON.stringify({
        group,
        pages: editedPages.map((b) => b.id),
      }),
    );

    const data = await response.json();

    if (!data.ok) {
      await horusAlert(data.msg);
    } else {
      getDatabase();
    }
  }, [editedPages, group, getDatabase]);

  useEffect(() => {
    setFilteredPages(allPages.filter((b) => b.id?.includes(currentFilter)));
  }, [currentFilter, allPages]);

  useEffect(() => {
    const parsedPages: string[] | null = JSON.parse(pages);

    if (parsedPages) {
      const presentPages: PluginPage[] = allPages.filter((b) => {
        return parsedPages.find((p) => {
          return p === b.id;
        });
      });

      setEditedPages(presentPages);
    } else {
      setEditedPages([]);
    }
  }, [pages, allPages]);

  return (
    <div
      className="plugin-variable-value p-4"
      style={{
        height: "70vh",
        overflow: "auto",
      }}
    >
      <div className="flex flex-row gap-2 w-full">
        <SearchComponent
          className="w-full"
          placeholder="Search for an extension"
          onChange={(e) => {
            setCurrentFilter(e.target.value);
          }}
          showIcon={false}
        />
        <AppButton
          action={() => {
            // Create an array of filtered blocks that are not already in the set
            const blocksToAdd = filteredPages.filter(
              (f) => !editedPages.find((e) => e.id === f.id),
            );

            // Concatenate the unique filtered blocks to the current edited blocks
            setEditedPages([...editedPages, ...blocksToAdd]);
          }}
        >
          All
        </AppButton>
        <AppButton
          action={() => {
            setEditedPages((editedPages) => {
              return editedPages.filter(
                (b) => !filteredPages.find((f) => f.id === b.id),
              );
            });
          }}
        >
          None
        </AppButton>
        <AppButton action={modifyGroup}>Apply</AppButton>
      </div>
      {filteredPages.length === 0 ? (
        <div className="grid place-items-center mt-8">
          {loading ? "Loading..." : "No extensions"}
        </div>
      ) : (
        <div className="w-full overflow-auto min-h-12 mt-2">
          {filteredPages.map((filteredP) => (
            <div
              key={filteredP.id}
              className="flex flex-row items-center justify-between border-t-2"
              style={{
                gap: "1rem",
                textAlign: "left",
                paddingInline: "0.5rem",
              }}
            >
              <input
                style={{ width: "1rem" }}
                type="checkbox"
                checked={
                  editedPages?.find((b) => b.id === filteredP.id) !== undefined
                }
                onChange={(e) =>
                  setEditedPages(
                    e.target.checked
                      ? [...(editedPages ?? []), filteredP]
                      : (editedPages ?? []).filter(
                          (blo: PluginPage) => blo.id !== filteredP.id,
                        ),
                  )
                }
              />
              <div className="w-full gap-2 items-start py-1">
                {filteredP.id}{" "}
                <span className="text-xs text-muted">
                  {filteredP.description}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function _Loading() {
  return (
    <div className="flex flex-col justify-center items-center m-auto h-full">
      <RotatingLines />
      Loading...
    </div>
  );
}
