import { LazyLog } from "@melloware/react-logviewer";
import HorusSwitch from "../Switch/switch";
import { HorusPopover } from "../reusable";
import AppButton from "../appbutton";
import RotatingLines from "../RotatingLines/rotatinglines";
import StopIcon from "../Toolbar/Icons/Stop";
import { useEffect, useState } from "react";

type HorusLazyLogProps = {
  logText: string;
  keepDisabled?: boolean;
};

export function HorusLazyLog(props: HorusLazyLogProps) {
  const { logText } = props;

  const parsedLogText = logText || "No logs";

  const [internalText, setInternalText] = useState<string>(parsedLogText);
  const [logging, setLogging] = useState<boolean>(true);

  useEffect(() => {
    setLogging(!props.keepDisabled);
  }, [props.keepDisabled]);

  useEffect(() => {
    if (logging) {
      setInternalText(parsedLogText);
    }
  }, [parsedLogText, logging]);

  return (
    <div className="flex flex-col h-full p-2">
      <div
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
}
