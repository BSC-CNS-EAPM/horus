import { DockviewPanelApi } from "dockview-react";
import { useEffect, useState, useRef } from "react";
import AppButton from "../appbutton";
import { Editor } from "@monaco-editor/react";
import { HorusPopover } from "../reusable";
import SaveIcon from "../Toolbar/Icons/Save";

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
    txt: "plaintext"
  };
  return ext ? languageMap[ext] || "plaintext" : "plaintext";
};

export function HorusFileEditor({
  dockApi,
  params
}: {
  dockApi: DockviewPanelApi;
  params: any;
}) {
  const [path, setPath] = useState<string | null>(params.path ?? null);
  const [value, setValue] = useState<string>("");
  const [loadingFile, setLoadingFile] = useState(false);
  const [fileType, setFileType] = useState<string>("plaintext");
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasOpenedPicker = useRef(path ? true : false); // Prevent double execution

  useEffect(() => {
    if (!hasOpenedPicker.current) {
      window.horus?.openExtensionFilePicker?.({
        onFileConfirm: (file) => {
          setPath(file);
        }
      });
      hasOpenedPicker.current = true;
    }
  }, []);

  useEffect(() => {
    if (!path) return;

    dockApi.setTitle(params.title ?? path.split("/").pop() ?? "Untitled");
    dockApi.updateParameters({ path });
    setFileType(params?.format ?? getFileLanguage(path));
    setLoadingFile(true);

    window.horus
      ?.getFile(path, { onlyText: true, onlyFiles: true })
      .then((file) => file.text())
      .then((text) => {
        setValue(text);
        setError(null);
        setHasChanges(false);
      })
      .catch((err) => setError("Error loading file: " + err))
      .finally(() => setLoadingFile(false));
  }, [path, dockApi, params]);

  if (!path || error) {
    return (
      <div className="inline-box grid items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          {error && (
            <div className="inline-box grid items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="text-red-500 text-center">{error}</div>
              </div>
            </div>
          )}
          <AppButton
            action={() =>
              window.horus?.openExtensionFilePicker?.({
                onFileConfirm: (file) => setPath(file)
              })
            }
          >
            Select a file
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <div className="absolute top-0 right-0 z-10 mt-2 mr-5">
        <div className="flex flex-row gap-2">
          {hasChanges && (
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
          )}
          <HorusPopover
            trigger={
              <AppButton
                action={() => {
                  const file = new File(
                    [value],
                    `${path.split("/").pop() ?? "file"}`,
                    {
                      type: "text/plain"
                    }
                  );
                  window.horus.saveFile(file);
                }}
              >
                <SaveIcon />
              </AppButton>
            }
          >
            <div
              className="hover-description"
              style={{
                position: "absolute",
                transform: "translateX(-30px) translateY(10px)"
              }}
            >
              Save file
            </div>
          </HorusPopover>
        </div>
      </div>

      <Editor
        key={JSON.stringify(params)}
        options={{ readOnly: params?.readOnly }}
        value={value}
        loading={loadingFile}
        path={path}
        language={fileType}
        onChange={
          params.readOnly
            ? undefined
            : (newValue) => {
                setValue(newValue || "");
                setHasChanges(true);
              }
        }
      />
    </div>
  );
}
