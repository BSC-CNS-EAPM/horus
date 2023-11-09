import { setChonkyDefaults, ChonkyActions } from "chonky";
import { ChonkyIconFA } from "chonky-icon-fontawesome";
import { horusPost } from "../../Utils/utils";
import React, { useEffect, useRef, useState } from "react";
import { HorusModal } from "../reusable";
import NBDButton from "../nbdbutton";

// Somewhere in your `index.ts`:
// @ts-ignore
setChonkyDefaults({ iconComponent: ChonkyIconFA });

import { FileBrowser, FileNavbar, FileToolbar, FileList } from "chonky";

declare global {
  interface Window {
    isDesktop: boolean;
  }
}

// Create custom hook for server picker file explorer
function useServerExplorer(
  openFolder: boolean,
  onFileSelect: (file: any) => void,
  onFileConfirm: (file: any) => void,
  extensions?: string[]
) {
  const [files, setFiles] = useState([]);
  const [folderChain, setFolderChain] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const currentPath = useRef(null);

  const fetchFolders = async () => {
    const header = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    };

    const body = JSON.stringify({
      path: currentPath.current,
      extensions: extensions,
      openFolder: openFolder,
    });

    const response = await horusPost("/filepicker", header, body);

    const data = await response.json();

    if (!data.ok) {
      alert(data.msg);
    }

    setFiles(data.contents);
    setFolderChain(data.folderChain);
  };

  const handleFileAction = (action) => {
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
  };

  useEffect(() => {
    fetchFolders();
  }, []);

  return {
    files,
    folderChain,
    selectedFile,
    handleFileAction,
  };
}

type FileExplorerProps = {
  children?: React.ReactNode;
  openFolder?: boolean;
  onFileSelect: (file: any) => void;
  onFileConfirm: (file: any) => void;
  allowedExtensions?: string[];
};

type ServerFileExplorerModalProps = {
  fileProps: FileExplorerProps;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
};

function ServerFileExplorerModal(props: ServerFileExplorerModalProps) {
  const { open, setOpen, fileProps } = props;

  const onFileConfirm = (file: any) => {
    fileProps.onFileConfirm(file);
    setOpen(false);
  };

  const openFolder = fileProps.openFolder || false;
  const { files, folderChain, handleFileAction, selectedFile } =
    useServerExplorer(
      openFolder,
      fileProps.onFileSelect,
      onFileConfirm,
      fileProps.allowedExtensions
    );
  return (
    <HorusModal
      show={open}
      onHide={() => setOpen(false)}
      header={openFolder ? "Select a folder" : "Select a file"}
      footer={
        <div className="flex justify-end flex-row gap-2">
          <NBDButton
            action={() => {
              setOpen(false);
            }}
          >
            Close
          </NBDButton>
          <NBDButton
            action={() => {
              fileProps.onFileConfirm(selectedFile);
              setOpen(false);
            }}
          >
            Select
          </NBDButton>
        </div>
      }
      size="xl"
    >
      <div
        style={{
          height: "70vh",
          width: "100%",
        }}
      >
        <FileBrowser
          defaultFileViewActionId={ChonkyActions.EnableListView.id}
          files={files}
          folderChain={folderChain}
          onFileAction={handleFileAction}
        >
          <FileNavbar />
          <FileToolbar />
          <FileList />
        </FileBrowser>
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
      <NBDButton
        action={() => {
          setOpen(true);
        }}
      >
        {props.children}
      </NBDButton>
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

    const postTo = openFolder ? "/openfolder" : "/openfile";

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
    props.onFileSelect,
    props.onFileConfirm,
    props.allowedExtensions
  );

  return (
    <div>
      <NBDButton action={openFilePicker}>{props.children}</NBDButton>
    </div>
  );
}

function HorusFileExplorer(props: FileExplorerProps) {
  if (window.isDesktop || window.parent.isDesktop) {
    return <DesktopFileExplorer {...props} />;
  } else {
    return <ServerFileExplorer {...props} />;
  }
}

export { ServerFileExplorerModal, HorusFileExplorer };
