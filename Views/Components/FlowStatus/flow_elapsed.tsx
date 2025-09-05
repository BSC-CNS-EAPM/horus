// React
import { useEffect, useState } from "react";

export function FlowElapsed({
  startedTime,
  finishedTime,
  elapsed
}: {
  startedTime: number | undefined;
  finishedTime: number | undefined;
  elapsed: number;
}) {
  const [timer, setTimer] = useState<number>(Date.now());

  useEffect(() => {
    let interval: Timer;

    if (startedTime && !finishedTime) {
      interval = setInterval(() => {
        setTimer(Date.now());
      }, 1000);
    }
    return () => {
      clearInterval(interval);
    };
  }, [startedTime, finishedTime]);

  //   If the flow has elapsed time > 0 and has a finished time, then show just the elapsed
  if (finishedTime) {
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = Math.floor(elapsed % 60);

    return (
      <HoursMinutesSeconds hours={hours} minutes={minutes} seconds={seconds} />
    );
  }

  if (startedTime && startedTime > 0) {
    let elapsedSeconds = timer / 1000 - startedTime;

    if (elapsedSeconds < 0) {
      elapsedSeconds = 0;
    }

    elapsedSeconds += elapsed;

    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = Math.floor(elapsedSeconds % 60);

    return (
      <HoursMinutesSeconds hours={hours} minutes={minutes} seconds={seconds} />
    );
  }

  return <div>-</div>;
}

function HoursMinutesSeconds({
  hours,
  minutes,
  seconds
}: {
  hours: number;
  minutes: number;
  seconds: number;
}) {
  return (
    <div>{`${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`}</div>
  );
}
