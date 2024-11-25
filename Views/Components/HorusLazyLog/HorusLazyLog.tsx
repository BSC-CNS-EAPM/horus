import { LazyLog } from "@melloware/react-logviewer";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import AppButton from "../appbutton";
import { HorusPopover } from "../reusable";
import RotatingLines from "../RotatingLines/rotatinglines";
import HorusSwitch from "../Switch/switch";
import SaveIcon from "../Toolbar/Icons/Save";
import StopIcon from "../Toolbar/Icons/Stop";
import CenterView from "../Toolbar/Icons/CenterView";

type HorusLazyLogProps = {
  logText: string;
  keepDisabled?: boolean;
  filename?: string;
};

export function HorusLazyLog(props: HorusLazyLogProps) {
  const { logText, filename } = props;

  const parsedLogText = logText || "No logs";

  const [internalText, setInternalText] = useState<string>(parsedLogText);
  const [logging, setLogging] = useState<boolean>(true);
  const [fullScreen, setFullScreen] = useState<boolean>(false);

  useEffect(() => {
    setLogging(!props.keepDisabled);
  }, [props.keepDisabled]);

  useEffect(() => {
    if (logging) {
      setInternalText(parsedLogText);
    }
  }, [parsedLogText, logging]);

  const LoggingView = (
    <div
      className="flex flex-col h-full p-2"
      style={
        fullScreen
          ? {
              position: "absolute",
              width: "100%",
            }
          : undefined
      }
    >
      <div
        className="flex flex-row justify-between items-center gap-2"
        style={{
          position: "absolute",
          marginTop: "0.5rem",
          marginLeft: "0.5rem",
        }}
      >
        <HorusPopover
          trigger={
            <div className="flex flex-row items-center gap-2">
              <HorusSwitch
                enabled={logging}
                setEnabled={setLogging}
                disabled={props.keepDisabled}
              >
                Live logs
              </HorusSwitch>

              <AppButton
                disabled={props.keepDisabled}
                action={() => {
                  setLogging(!logging);
                }}
              >
                <div className="flex flex-row gap-2 items-center">
                  {logging ? (
                    <>
                      Logging... <RotatingLines size={"1.5rem"} />
                    </>
                  ) : (
                    <>
                      <StopIcon color="var(--red-error)" /> Stopped
                    </>
                  )}
                </div>
              </AppButton>
            </div>
          }
        >
          <div
            className="hover-description p-2"
            style={{
              position: "absolute",
              transform: "translateX(100px) translateY(10px)",
            }}
          >
            Disable live logging to interact with the text
          </div>
        </HorusPopover>
        <HorusPopover
          trigger={
            <AppButton
              action={() => {
                const file = new File(
                  [parsedLogText],
                  `${filename ?? "logs.log"}`,
                  {
                    type: "text/plain",
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
            className="hover-description p-2"
            style={{
              position: "absolute",
              transform: "translateX(70px) translateY(10px)",
            }}
          >
            Save logs
          </div>
        </HorusPopover>
        <HorusPopover
          trigger={
            <AppButton
              action={() => {
                setFullScreen(!fullScreen);
              }}
            >
              <CenterView />
            </AppButton>
          }
        >
          <div
            className="hover-description p-2"
            style={{
              position: "absolute",
              transform: "translateX(70px) translateY(10px)",
            }}
          >
            Toggle fullscreen
          </div>
        </HorusPopover>
      </div>

      <div className="h-full overflow-hidden rounded-xl">
        <LazyLog
          style={{
            pointerEvents: logging ? "none" : "auto",
          }}
          caseInsensitive
          enableHotKeys
          enableSearch
          extraLines={1}
          selectableLines
          text={internalText}
          follow={logging}
        />
      </div>
    </div>
  );

  if (fullScreen) {
    return createPortal(LoggingView, document.documentElement);
  }

  return LoggingView;
}
