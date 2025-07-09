import {
  ChonkyActions,
  FileActionState,
  FileArray,
  FileData,
  setChonkyDefaults,
} from "chonky";
import { ChonkyIconFA } from "chonky-icon-fontawesome";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

// Ignore React18 errors until frontend-rewrite
// @ts-ignore
import { render } from "react-dom";
import { horusPost, POSTUploadWithProgress } from "../../Utils/utils";
import AppButton from "../appbutton";
import { BlurredModal } from "../reusable";

// Somewhere in your `index.ts`:
// @ts-ignore
setChonkyDefaults({ iconComponent: ChonkyIconFA });

import { FileBrowser, FileList, FileNavbar, FileToolbar } from "chonky";

import { GLOBAL_IDS } from "../../Utils/globals";
import { useAlert } from "../HorusPrompt/horus_alert";
import { usePrompt } from "../HorusPrompt/horus_prompt";
import { FlowBuilderContext } from "../MainApp/PanelView";

function getDirOfPath(path?: string | null) {
  if (!path) return null;

  return path.split("/").slice(0, -1).join("/");
}

// Create custom hook for server picker file explorer
function useServerExplorer(
  openFolder: boolean,
  onFileSelect: (file: FileData) => void,
  onFileConfirm: (file: FileData) => void,
  setOpen: (open: boolean) => void,
  extensions?: string[],
  // If this is true (or defined) means that an extension
  // Wants to get a path. Due to how this work
  // We need to append the user paths directory
  // in this specific case. (Server will do that)
  openDirectly?: boolean,

  // Needed for opening the file explore routside a flow
  // for example, in the plugin installer page
  openOutsideFlowContext: boolean = false
) {
  const [files, setFiles] = useState<FileArray>([null]);
  const [folderChain, setFolderChain] = useState<FileArray>([null]);
  const [selectedFile, setSelectedFile] = useState<FileData | null>(null);
  const [actionFilesActive, setActionFilesActive] = useState({
    status: false,
    progress: 0,
    file: "",
    text: "",
  });

  const flowBuilderContext = useContext(FlowBuilderContext);

  const currentPath = useRef(null);

  const horusAlert = useAlert();

  const fetchFolders = useCallback(
    async (
      openPath?: string,
      options?: {
        setGoToPathAsSelected: boolean;
      }
    ) => {
      const header = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      };

      if (
        window.horusInternal.webApp &&
        !flowBuilderContext?.flow?.flow?.path &&
        !openDirectly &&
        !openOutsideFlowContext
      ) {
        await horusAlert("Save or open a flow before selecting files.");
        setOpen(false);
        return;
      }

      let currentFiles: typeof files = files;
      let currentFolderChain: typeof folderChain = folderChain;

      setFiles((f) => {
        currentFiles = f;
        return [null];
      });
      setFolderChain((c) => {
        currentFolderChain = c;
        return [null];
      });

      const body = JSON.stringify({
        path:
          openPath ??
          currentPath.current ??
          getDirOfPath(flowBuilderContext?.flow?.flow?.path),
        extensions: extensions,
        openFolder: openFolder,
        flowContextPath: flowBuilderContext?.flow?.flow?.path,
        obfuscate: !openDirectly,
        openOutsideFlowContext: openOutsideFlowContext,
      });

      const response = await horusPost("/api/filepicker", header, body);

      const data = await response.json();

      if (!data.ok) {
        await horusAlert(data.msg);
        setFiles(currentFiles);
        setFolderChain(currentFolderChain);
        return;
      }

      setFiles(data.contents);
      setFolderChain(data.folderChain);

      // If the selected path is null, set it to the current path if we are on folder mode
      if (!selectedFile && openFolder) {
        const fileToSelect = data.folderChain[data.folderChain.length - 1];

        if (fileToSelect) {
          setSelectedFile(fileToSelect);
          onFileSelect(fileToSelect["path"]);
        }
      }

      if (!currentPath.current) {
        currentPath.current =
          data.folderChain[data.folderChain.length - 1].path;
      }

      if (options?.setGoToPathAsSelected) {
        setSelectedFile(data.folderChain[data.folderChain.length - 1]);
        onFileSelect(data.folderChain[data.folderChain.length - 1]["path"]);
      }
    },
    [
      extensions,
      openFolder,
      selectedFile,
      flowBuilderContext,
      setOpen,
      folderChain,
      openDirectly,
      files,
      onFileSelect,
      openOutsideFlowContext,
    ]
  );

  const handleFileAction = (action: FileActionState) => {
    const targetFile = action["payload"]?.targetFile;
    const payloadFile = action["payload"]?.file;

    // If the action is double clickinga folder, open it
    if (action["id"] === "open_files") {
      if (targetFile && targetFile.isDir) {
        currentPath.current = targetFile["path"];
        fetchFolders();
      }
    }

    // If the action is clicking a file, set the selected file
    if (action["id"] === "mouse_click_file") {
      // If open folder mode is enable, select only folders
      if (payloadFile) {
        setSelectedFile(payloadFile);
        onFileSelect(payloadFile);
      }
    }

    // If the action is opening a file, call the onFileConfirm function
    if (action["id"] === "open_files") {
      if (targetFile && !targetFile.isDir) {
        setSelectedFile(targetFile);
        onFileConfirm(targetFile);
      }
    }

    if (action["id"] === "create_folder") {
      createFolder();
    }

    if (action["id"] === "upload_files") {
      filePicker.current?.click();
    }

    if (action["id"] === "download_files") {
      downloadFiles(action["state"].selectedFilesForAction);
    }

    if (action["id"] === "delete_files") {
      deleteFiles(action["state"].selectedFilesForAction);
    }
  };

  const horusPrompt = usePrompt();

  const createFolder = useCallback(async () => {
    // Ask the user for the folder name
    const folderName = await horusPrompt("Enter the folder name");

    if (!folderName) {
      return;
    }

    const header = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };

    const body = JSON.stringify({
      path: currentPath.current,
      folderName: folderName,
      flowContextPath: flowBuilderContext?.flow?.flow?.path,
    });

    const response = await horusPost(
      "/api/filepicker/createfolder",
      header,
      body
    );

    const data = await response.json();

    if (!data.ok) {
      await horusAlert(data.msg);
    }

    fetchFolders();
  }, [currentPath, fetchFolders, flowBuilderContext?.flow?.flow?.path]);

  const resetActionFiles = useCallback(() => {
    setActionFilesActive({
      status: false,
      progress: 0,
      file: "",
      text: "",
    });

    // Re-fetch the items
    fetchFolders();
  }, [fetchFolders]);

  const filePicker = useRef<HTMLInputElement>(null);
  const uploadFiles = useCallback(async () => {
    const element = filePicker.current;

    if (!element) {
      return;
    }
    // Ask the user for the files opening the file picker
    const files = element.files;

    if (!files) {
      return;
    }

    const header = {
      Accept: "application/json",
      "Access-Control-Allow-Origin": "*",
    };

    for (let i = 0; i < files.length; i++) {
      const file = files[i]!;
      const fileSize = file.size / 1024 ** 2;

      if (fileSize > (window.horusInternal.webApp?.uploadSize ?? 50)) {
        await horusAlert(
          `The filze size exceeds the maximum of ${
            window.horusInternal.webApp?.uploadSize ?? 2
          } MB`
        );
        return;
      }

      const formData = new FormData();
      formData.append("files", files[i]!);
      formData.append("path", currentPath.current!);
      formData.append(
        "flowContextPath",
        flowBuilderContext?.flow?.flow?.path ?? ""
      );

      // Check if its size is more than the maximum allowed
      setActionFilesActive({
        status: true,
        progress: 0,
        file: files[i]!.name,
        text: "Uploading files...",
      });

      const data: any = await POSTUploadWithProgress(
        "/api/filepicker/upload",
        formData,
        (percentage) => {
          setActionFilesActive((currentText) => ({
            ...currentText,
            progress: percentage,
          }));
        }
      );

      if (!data.ok) {
        await horusAlert(data.msg);
        break;
      }
    }

    fetchFolders();

    resetActionFiles();
  }, [
    currentPath,
    fetchFolders,
    resetActionFiles,
    flowBuilderContext?.flow?.flow?.path,
  ]);

  const downloadFiles = useCallback(
    async (filePaths: FileData[]) => {
      const header = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      };

      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i]!;

        setActionFilesActive({
          status: true,
          progress: ((2 * i + 1) / (filePaths.length * 2)) * 100,
          file: filePath.name,
          text: "Downloading files...",
        });

        const body = JSON.stringify({
          path: filePath["path"],
          flowContextPath: flowBuilderContext?.flow?.flow?.path,
        });

        const response = await horusPost(
          "/api/filepicker/download",
          header,
          body
        );

        if (response.headers.get("content-type") === "application/json") {
          const data = await response.json();

          if (!response.ok) {
            await horusAlert(data.msg);
            break;
          }
        }

        // If the response is not a JSON, continue
        const data = await response.blob();
        // Get the name of the file (last part of the path)
        let fileName = filePath.name;

        // Folders are downloaded as zips
        if (filePath.isDir) {
          fileName = fileName + ".zip";
        }

        const file = new File([data], fileName ?? "downloaded_file", {
          type: "application/octet-stream",
        });

        await new Promise((resolve) => setTimeout(resolve, 1000));

        setActionFilesActive((currentText) => ({
          ...currentText,
          progress: ((2 * i + 2) / (filePaths.length * 2)) * 100,
        }));

        window.horus.saveFile(file);
      }
      resetActionFiles();
    },
    [resetActionFiles, flowBuilderContext?.flow?.flow?.path]
  );

  const deleteFiles = useCallback(
    async (
      filePaths: [
        {
          path: string;
        },
      ]
    ) => {
      const header = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      };

      for (let i = 0; i < filePaths.length; i++) {
        const filePath = filePaths[i]!;

        setActionFilesActive({
          status: true,
          progress: (i / filePaths.length) * 100,
          file: filePath.path,
          text: "Deleting files...",
        });

        const body = JSON.stringify({
          path: filePath.path,
          flowContextPath: flowBuilderContext?.flow?.flow?.path,
        });

        const response = await horusPost(
          "/api/filepicker/delete",
          header,
          body
        );

        const data = await response.json();

        if (!data.ok) {
          await horusAlert(data.msg);
          break;
        }
      }

      resetActionFiles();
    },
    [resetActionFiles, flowBuilderContext?.flow?.flow?.path]
  );

  return {
    files,
    folderChain,
    setFolderChain,
    selectedFile,
    setSelectedFile,
    isUploading: actionFilesActive,
    handleFileAction,
    fetchFolders,
    filePicker,
    uploadFiles,
  };
}

export type FileExplorerProps = {
  label?: string;
  openAtPath?: string;
  children?: React.ReactNode;
  openFolder?: boolean;
  onFileSelect?: (file: string) => void;
  onFileConfirm?: (file: string) => void;
  allowedExtensions?: string[];
  openDirectly?: boolean;
  openOutsideFlowContext?: boolean;
  onClose?: (selectedPath: string | null) => void;
};

type ServerFileExplorerModalProps = {
  fileProps?: FileExplorerProps;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function ServerFileExplorerModal(props: ServerFileExplorerModalProps) {
  const { open, setOpen, fileProps } = props;

  const [manualPath, setManualPath] = useState<string>("");
  const [goToPath, setGoToPath] = useState<string>("");
  const [selectedIsDir, setSelectedIsDir] = useState<boolean>(false);

  const handleClose = useCallback(
    (selectedPath: string | null = null) => {
      setOpen(false);
      fileProps?.onClose && fileProps.onClose(selectedPath);
    },
    [setOpen, fileProps]
  );

  const onFileConfirm = (file: FileData) => {
    const path = file["path"];

    if (file.isDir && !fileProps?.openFolder) {
      return;
    }

    fileProps?.onFileConfirm ? fileProps.onFileConfirm(path) : null;
    handleClose(path);
  };

  const onFileSelect = (file: FileData) => {
    const path = file["path"];

    if (!path) {
      return;
    }

    if (file.isDir) {
      setGoToPath(path);
    } else {
      setGoToPath(getDirOfPath(path) ?? "");
    }

    if (file.isDir) {
      setSelectedIsDir(true);
    } else {
      setSelectedIsDir(false);
    }

    if (file.isDir && !fileProps?.openFolder) {
      return;
    }

    fileProps?.onFileSelect ? fileProps.onFileSelect(path) : null;
  };

  const openFolder = fileProps?.openFolder ?? false;
  const {
    files,
    folderChain,
    handleFileAction,
    selectedFile,
    isUploading,
    fetchFolders,
    setSelectedFile,
    setFolderChain,
    filePicker,
    uploadFiles,
  } = useServerExplorer(
    openFolder,
    onFileSelect,
    onFileConfirm,
    (open) => {
      if (!open) {
        handleClose();
      }
      setOpen(open);
    },
    fileProps?.allowedExtensions,
    fileProps?.openDirectly,
    fileProps?.openOutsideFlowContext
  );

  useEffect(() => {
    setSelectedIsDir(
      selectedFile?.isDir === undefined ? false : selectedFile.isDir
    );
  }, [selectedFile]);

  const chonkyActions = [
    ChonkyActions.UploadFiles,
    ChonkyActions.DownloadFiles,
    ChonkyActions.CreateFolder,
    ChonkyActions.DeleteFiles,
  ];

  const [tabIndex, setTabIndex] = useState(0);

  const disabledSelect = () => {
    if (manualPath) return false;

    if (!selectedFile) return true;

    const requiresFolder = props.fileProps?.openFolder ?? false;

    if (requiresFolder === selectedIsDir) {
      return false;
    }

    return true;
  };

  useEffect(() => {
    if (open) {
      let openAtPath = fileProps?.openAtPath;

      if (openAtPath) {
        if (!fileProps?.openFolder) {
          openAtPath = getDirOfPath(openAtPath) ?? undefined;
        }
      }

      setGoToPath(openAtPath ?? "");
      fetchFolders(openAtPath);
    } else {
      // Reset the selected file
      setSelectedFile(null);
      setFolderChain([null]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const getLabel = () => {
    if (fileProps) {
      if (fileProps.label) {
        return fileProps.label;
      }
      return fileProps.openFolder ? "Select a folder" : "Select a file";
    }

    return "Browse";
  };

  useEffect(() => {
    setManualPath(selectedFile?.["path"] || "");
  }, [selectedFile]);

  return (
    <BlurredModal
      show={open}
      onHide={() => {
        handleClose();
      }}
      maxContentSize={{
        width: "90%",
      }}
      overRoot
    >
      <div className="w-full flex flex-col gap-2 p-4">
        <div className="flex flex-col gap-2 flex-wrap justify-start items-start">
          <div className="text-3xl font-bold min-w-[180px]">{getLabel()}</div>
          {(!window.horusInternal?.webApp ||
            props.fileProps?.openOutsideFlowContext) && (
            <div className="flex flex-row gap-2 w-full">
              <input
                className="app-button w-full"
                placeholder="Input a folder path..."
                value={goToPath}
                onChange={(e) => {
                  setGoToPath(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (goToPath) {
                      fetchFolders(goToPath, {
                        setGoToPathAsSelected: true,
                      });

                      if (
                        props.fileProps?.onFileSelect &&
                        props.fileProps.openFolder
                      ) {
                        props.fileProps?.onFileSelect(goToPath);
                      }
                    }
                  }
                  if (e.key === "Escape") {
                    setGoToPath("");
                  }
                  if (e.key === "Tab") {
                    e.preventDefault();

                    // If the last part of the path ends with "/", go to the current path and start the tabbing there
                    if (goToPath.endsWith("/")) {
                      // Remove also the last /
                      const goingTo = goToPath.slice(0, -1);
                      setGoToPath(goingTo);
                      fetchFolders(goingTo, {
                        setGoToPathAsSelected: true,
                      });
                      return;
                    }

                    // If there is something typed from the last /
                    // Then autocomplete
                    const folders = files.filter((f) => f?.isDir);

                    if (folders.length === 0) return;

                    const lastPart = goToPath.split("/").pop();
                    if (lastPart && lastPart.length > 0) {
                      // Find the folder to autocomplete
                      const folder = folders.find((f) =>
                        f?.name.includes(lastPart)
                      );
                      if (folder) {
                        // If the folder was fully completed, then do nothing
                        if (folder["path"] !== goToPath) {
                          setGoToPath(folder["path"]);
                          return;
                        }
                      }
                    }

                    let currentTabIndex = tabIndex;

                    // Wrap around the folder list if necessary
                    if (currentTabIndex >= folders.length) {
                      currentTabIndex = 0;
                    }

                    const nextFolder = folders[currentTabIndex];

                    if (!nextFolder) return;

                    setGoToPath(nextFolder["path"]);
                    setTabIndex(currentTabIndex + 1);
                  }
                }}
              />
              <AppButton
                className="min-w-[40px]"
                action={() => {
                  goToPath &&
                    fetchFolders(goToPath, {
                      setGoToPathAsSelected: true,
                    });
                }}
              >
                Go
              </AppButton>
            </div>
          )}
        </div>
        <div className="w-full" style={{ height: "65vh" }}>
          <FileBrowser
            defaultFileViewActionId={ChonkyActions.EnableListView.id}
            fileActions={chonkyActions}
            files={files}
            folderChain={folderChain}
            onFileAction={handleFileAction}
            doubleClickDelay={1000}
            disableDragAndDrop
          >
            {isUploading.status ? (
              <div className="h-full flex flex-col gap-2 justify-center items-center">
                <div className="flex flex-row gap-2">
                  <div className="horus-container p-2">{isUploading.text}</div>
                  <div className="horus-container p-2 flex flex-row gap-2 items-center justify-center">
                    {isUploading.progress.toFixed(1)} %
                  </div>
                </div>
                <div className="horus-container p-2">{isUploading.file}</div>
              </div>
            ) : (
              <>
                <FileNavbar />
                <FileToolbar />
                <FileList />
              </>
            )}
          </FileBrowser>
        </div>
        <div className="flex justify-end flex-row gap-2">
          <input
            style={{ display: "none" }}
            hidden
            type="file"
            ref={filePicker}
            onChange={uploadFiles}
          ></input>
          <div className="flex flex-row gap-2 flex-grow">
            <div className="plugin-variable-value">
              <input
                placeholder="Select a path manually..."
                className="plugin-variable-value"
                value={manualPath || selectedFile?.["path"]}
                onChange={(e) => {
                  setSelectedFile(null);
                  setManualPath(e.target.value);
                }}
              />
            </div>
            <AppButton
              disabled={disabledSelect()}
              className="min-w-[120px]"
              action={() => {
                fileProps?.onFileConfirm?.(manualPath);
                handleClose(manualPath || null);
              }}
            >
              Select
            </AppButton>
          </div>
          <AppButton
            action={() => {
              handleClose();
            }}
          >
            Close
          </AppButton>
          {/* {fileProps?.onFileConfirm && (
            <AppButton
              disabled={disabledSelect()}
              action={() => {
                fileProps?.onFileConfirm
                  ? fileProps.onFileConfirm(selectedFile?.["path"])
                  : null;
                handleClose();
              }}
            >
              Select
            </AppButton>
          )} */}
        </div>
      </div>
    </BlurredModal>
  );
}

function ServerFileExplorer(props: FileExplorerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (props.openDirectly) {
      setOpen(true);
    }
  }, [props.openDirectly]);

  return (
    <div>
      <ServerFileExplorerModal
        fileProps={props}
        open={open}
        setOpen={setOpen}
      />
      {props.children && (
        <AppButton
          action={() => {
            setOpen(true);
          }}
        >
          {props.children}
        </AppButton>
      )}
    </div>
  );
}

function useDesktopExplorer(
  openFolder: boolean,
  onFileSelect: (path: string) => void,
  onFileConfirm: (path: string) => void,
  allowedExtensions?: string[]
) {
  const openFilePicker = async () => {
    const header = {
      "Content-Type": "application/json",
      accept: "application/json",
    };

    const body = JSON.stringify({
      extensions: allowedExtensions,
    });

    const postTo = openFolder ? "/api/openfolder" : "/api/openfile";

    const request = await horusPost(postTo, header, body);

    const data = await request.json();

    // If the data.path is a list, store only the first element
    const path = Array.isArray(data.path) ? data.path[0] : data.path;

    onFileSelect(path);
    onFileConfirm(path);
  };

  return {
    openFilePicker,
  };
}

function DesktopFileExplorer(props: FileExplorerProps) {
  const openFolder = props.openFolder || false;

  const { openFilePicker } = useDesktopExplorer(
    openFolder,
    props.onFileSelect ? props.onFileSelect : (_) => _,
    props.onFileConfirm ? props.onFileConfirm : (_) => _,
    props.allowedExtensions
  );

  useEffect(() => {
    if (props.openDirectly) {
      openFilePicker();
    }
  }, [props.openDirectly, openFilePicker]);

  return (
    <div>
      <AppButton action={openFilePicker}>{props.children}</AppButton>
    </div>
  );
}

function HorusFileExplorer(props: FileExplorerProps) {
  if (window.horusInternal.isDesktop || window.parent.horusInternal.isDesktop) {
    return <DesktopFileExplorer {...props} />;
  } else {
    return <ServerFileExplorer {...props} />;
  }
}

export type ExtensionsFilePickerOptions = Omit<
  FileExplorerProps,
  "openAtPath" | "children" | "openDirectly"
>;

function openExtensionFilePicker(
  options: ExtensionsFilePickerOptions
): Promise<string | null> {
  return new Promise((resolve) => {
    let globalFilePicker = document.getElementById(
      GLOBAL_IDS.EXTENSIONS_FILEPICKER
    );

    if (globalFilePicker) {
      globalFilePicker.remove();
    }

    globalFilePicker = document.createElement("div");
    globalFilePicker.id = GLOBAL_IDS.EXTENSIONS_FILEPICKER;
    document.body.appendChild(globalFilePicker);

    render(
      <HorusFileExplorer
        {...options}
        openDirectly
        onClose={(selectedPath) => {
          resolve(selectedPath);
          options.onClose?.(selectedPath);
        }}
      />,
      globalFilePicker
    );
  });
}

window.horus.openExtensionFilePicker = openExtensionFilePicker;

export { HorusFileExplorer, ServerFileExplorerModal };
