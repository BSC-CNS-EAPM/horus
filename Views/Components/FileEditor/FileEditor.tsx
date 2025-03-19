import { DockviewPanelApi } from "dockview-react";
import { useEffect, useState, useRef } from "react";
import AppButton from "../appbutton";
import { Editor } from "@monaco-editor/react";

const getFileLanguage = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    js: "javascript",
    ts: "typescript",
    json: "json",
    py: "python",
    md: "markdown",
    html: "html",
    css: "css",
    cpp: "cpp",
    c: "c",
    java: "java",
    sh: "shell",
    txt: "plaintext",
  };
  return ext ? languageMap[ext] || "plaintext" : "plaintext";
};

export function HorusFileEditor({
  dockApi,
  params,
}: {
  dockApi: DockviewPanelApi;
  params: any;
}) {
  const [path, setPath] = useState<string | null>(params.path ?? null);
  const [value, setValue] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileType, setFileType] = useState<string>("plaintext");
  const [hasChanges, setHasChanges] = useState(false);

  const hasOpenedPicker = useRef(path ? true : false); // Prevent double execution

  useEffect(() => {
    if (!hasOpenedPicker.current) {
      window.horus?.openExtensionFilePicker?.({
        onFileConfirm: (file) => {
          setPath(file);
        },
      });
      hasOpenedPicker.current = true;
    }
  }, []);

  useEffect(() => {
    if (!path) return;

    dockApi.setTitle(path.split("/").pop() ?? "Untitled");
    dockApi.updateParameters({ path });
    setFileType(getFileLanguage(path));
    setLoadingFile(true);

    window.horus
      ?.getFile(path)
      .then((file) => file.text())
      .then((text) => setValue(text))
      .catch((err) => setValue("Error loading file: " + err))
      .finally(() => setLoadingFile(false));
  }, [path, dockApi]);

  if (!path) {
    return (
      <div className="inline-box grid items-center justify-center h-full">
        <AppButton
          action={() =>
            window.horus?.openExtensionFilePicker?.({
              onFileConfirm: (file) => setPath(file),
            })
          }
        >
          Select a file
        </AppButton>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {hasChanges && (
        <div className="absolute top-0 right-0 z-10 mt-2 mr-5">
          <AppButton
            action={async () => {
              if (path) {
                const filename =
                  path.split("/").pop() ?? (await prompt("File name"));

                if (!filename || filename === "") {
                  await alert("Please enter a name for the file");
                  return;
                }

                window.horus?.updateFile(
                  new File([value], filename, { type: fileType }),
                  path
                );

                setHasChanges(false);
              }
            }}
          >
            Save
          </AppButton>
        </div>
      )}
      <Editor
        value={value}
        loading={loadingFile}
        path={path}
        language={fileType}
        onChange={(newValue) => {
          setValue(newValue || "");
          setHasChanges(true);
        }}
      />
    </div>
  );
}
