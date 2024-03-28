import { setChonkyDefaults, ChonkyActions } from "chonky";
import { ChonkyIconFA } from "chonky-icon-fontawesome";
import { horusPost } from "../../Utils/utils";
import { useCallback, useContext, useEffect, useRef, useState } from "react";
import { HorusModal } from "../reusable";
import AppButton from "../appbutton";

// Somewhere in your `index.ts`:
// @ts-ignore
setChonkyDefaults({ iconComponent: ChonkyIconFA });

import { FileBrowser, FileNavbar, FileToolbar, FileList } from "chonky";
import { FlowContext } from "../FlowBuilder/flow.view";

function saveBlob(blob: Blob, fileName: string) {
  const a = document.createElement("a") as HTMLAnchorElement;
  document.body.appendChild(a);
  a.setAttribute("style", "display: none");

  const url = window.URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.click();
  window.URL.revokeObjectURL(url);
}

// Create custom hook for server picker file explorer
function useServerExplorer(
  openFolder: boolean,
  onFileSelect: (file: any) => void,
  onFileConfirm: (file: any) => void,
  setOpen: (open: boolean) => void,
  extensions?: string[]
) {
  const [files, setFiles] = useState([]);
  const [folderChain, setFolderChain] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [actionFilesActive, setActionFilesActive] = useState({
    status: false,
    progress: 0,
    file: "",
    text: "",
  });

  const flowContext = useContext(FlowContext);

  const currentPath = useRef(null);

  const fetchFolders = useCallback(async () => {
    const header = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };
    if (window.horusInternal.webApp && !flowContext?.path) {
      alert("Save the flow before selecting files");
      setOpen(false);
      return;
    }

    console.log("fetching folders at: ", flowContext?.path);

    const body = JSON.stringify({
      path: currentPath.current,
      extensions: extensions,
      openFolder: openFolder,
      flowContextPath: flowContext?.path,
    });

    const response = await horusPost("/api/filepicker", header, body);

    const data = await response.json();

    if (!data.ok) {
      alert(data.msg);
      setOpen(false);
      return;
    }

    setFiles(data.contents);
    setFolderChain(data.folderChain);

    // If the selected path is null, set it to the current path if we are on folder mode
    if (!selectedFile && openFolder) {
      setSelectedFile(data.folderChain[data.folderChain.length - 1].fullpath);
    }

    if (!currentPath.current) {
      currentPath.current =
        data.folderChain[data.folderChain.length - 1].fullpath;
    }
  }, [extensions, openFolder, selectedFile, flowContext, setOpen]);

  const handleFileAction = (action: any) => {
    // If the action is double clickinga folder, open it
    if (action.id === "open_files") {
      if (action.payload.targetFile.isDir) {
        currentPath.current = action.payload.targetFile.fullpath;
        fetchFolders();
      }
    }

    // If the action is clicking a file, set the selected file
    if (action.id === "mouse_click_file") {
      // If open folder mode is enable, select only folders
      if (openFolder) {
        if (action.payload.file.isDir) {
          setSelectedFile(action.payload.file.fullpath);
          onFileSelect(action.payload.file.fullpath);
        }
      }

      // If open folder mode is disabled, select only files
      else {
        if (!action.payload.file.isDir) {
          setSelectedFile(action.payload.file.fullpath);
          onFileSelect(action.payload.file.fullpath);
        }
      }
    }

    // If the action is opening a file, call the onFileConfirm function
    if (action.id === "open_files") {
      if (!action.payload.targetFile.isDir) {
        setSelectedFile(action.payload.targetFile.fullpath);
        onFileConfirm(action.payload.targetFile.fullpath);
      }
    }

    if (action.id === "create_folder") {
      createFolder();
    }

    if (action.id === "upload_files") {
      filePicker.current?.click();
    }

    if (action.id === "download_files") {
      downloadFiles(action.state.selectedFilesForAction);
    }

    if (action.id === "delete_files") {
      deleteFiles(action.state.selectedFilesForAction);
    }
  };

  const createFolder = useCallback(async () => {
    // Ask the user for the folder name
    const folderName = prompt("Enter the folder name");

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
      flowContextPath: flowContext?.path,
    });

    const response = await horusPost(
      "/api/filepicker/createfolder",
      header,
      body
    );

    const data = await response.json();

    if (!data.ok) {
      alert(data.msg);
    }

    fetchFolders();
  }, [currentPath, fetchFolders]);

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
        alert(
          `The filze size exceeds the maximum of ${
            window.horusInternal.webApp?.uploadSize ?? 2
          } MB`
        );
        return;
      }

      console.log("Generating post");

      const formData = new FormData();
      formData.append("files", files[i]!);
      formData.append("path", currentPath.current!);
      formData.append("flowContextPath", flowContext?.path ?? "");

      console.log("Posting upload files");

      // Check if its size is more than the maximum allowed
      setActionFilesActive({
        status: true,
        progress: (i / files.length) * 100,
        file: files[i]!.name,
        text: "Uploading files...",
      });

      const response = await horusPost(
        "/api/filepicker/upload",
        header,
        formData,
        undefined,
        null
      );

      const data = await response.json();

      if (!data.ok) {
        alert(data.msg);
        break;
      }
    }

    fetchFolders();

    resetActionFiles();
  }, [currentPath, fetchFolders, resetActionFiles]);

  const downloadFiles = useCallback(
    async (
      filePaths: [
        {
          fullpath: string;
        }
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
          file: filePath.fullpath,
          text: "Downloading files...",
        });

        const body = JSON.stringify({
          path: filePath.fullpath,
          flowContextPath: flowContext?.path,
        });

        const response = await horusPost(
          "/api/filepicker/download",
          header,
          body
        );

        if (response.headers.get("content-type") === "application/json") {
          const data = await response.json();

          if (!response.ok) {
            alert(data.msg);
            break;
          }
        }

        // If the response is not a JSON, continue
        const data = await response.blob();
        // Get the name of the file (last part of the path)
        const fileName = filePath.fullpath.split("/").pop();

        saveBlob(data, fileName ?? "downloaded_file");
      }
      resetActionFiles();
    },
    [resetActionFiles]
  );

  const deleteFiles = useCallback(
    async (
      filePaths: [
        {
          fullpath: string;
        }
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
          file: filePath.fullpath,
          text: "Deleting files...",
        });

        const body = JSON.stringify({
          path: filePath.fullpath,
          flowContextPath: flowContext?.path,
        });

        const response = await horusPost(
          "/api/filepicker/delete",
          header,
          body
        );

        const data = await response.json();

        if (!data.ok) {
          alert(data.msg);
          break;
        }
      }

      resetActionFiles();
    },
    [resetActionFiles]
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
  children?: React.ReactNode;
  openFolder?: boolean;
  onFileSelect?: (file: any) => void;
  onFileConfirm?: (file: any) => void;
  allowedExtensions?: string[];
};

type ServerFileExplorerModalProps = {
  fileProps?: FileExplorerProps;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function ServerFileExplorerModal(props: ServerFileExplorerModalProps) {
  const { open, setOpen, fileProps } = props;

  const onFileConfirm = (file: any) => {
    fileProps?.onFileConfirm ? fileProps.onFileConfirm(file) : null;
    setOpen(false);
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
    fileProps?.onFileSelect
      ? fileProps.onFileSelect
      : (_) => {
          _;
        },
    onFileConfirm,
    setOpen,
    fileProps?.allowedExtensions
  );

  const chonkyActions = [
    ChonkyActions.UploadFiles,
    ChonkyActions.DownloadFiles,
    ChonkyActions.CreateFolder,
    ChonkyActions.DeleteFiles,
  ];

  useEffect(() => {
    if (open) {
      fetchFolders();
    } else {
      // Reset the selected file
      setSelectedFile(null);
      setFolderChain(null);
    }
  }, [open, fetchFolders, setSelectedFile, setFolderChain]);

  return (
    <HorusModal show={open} onHide={() => setOpen(false)} size="xl">
      <div className="w-full flex flex-col gap-2 p-4">
        <div className="text-3xl text-bold">
          {fileProps
            ? openFolder
              ? "Select a folder"
              : "Select a file"
            : "Browse"}
        </div>
        <div
          className="w-full"
          style={{
            height: "65vh",
          }}
        >
          <FileBrowser
            defaultFileViewActionId={ChonkyActions.EnableListView.id}
            fileActions={chonkyActions}
            files={files}
            folderChain={folderChain}
            onFileAction={handleFileAction}
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
            hidden
            type="file"
            ref={filePicker}
            onChange={uploadFiles}
          ></input>
          <AppButton
            action={() => {
              setOpen(false);
            }}
          >
            Close
          </AppButton>
          {fileProps?.onFileConfirm && (
            <AppButton
              action={() => {
                fileProps?.onFileConfirm
                  ? fileProps.onFileConfirm(selectedFile)
                  : null;
                setOpen(false);
              }}
            >
              Select
            </AppButton>
          )}
        </div>
      </div>
    </HorusModal>
  );
}

function ServerFileExplorer(props: FileExplorerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <ServerFileExplorerModal
        fileProps={props}
        open={open}
        setOpen={setOpen}
      />
      <AppButton
        action={() => {
          setOpen(true);
        }}
      >
        {props.children}
      </AppButton>
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

export { ServerFileExplorerModal, HorusFileExplorer };
