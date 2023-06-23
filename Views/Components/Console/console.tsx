import { io } from "socket.io-client";
import { Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import React, { useEffect } from "react";
import { socket } from "../../Utils/socket";
import Terminal from "react-console-emulator";
import getCommands from "./commands";
import "./console.css";
// Setup the terminal

export default function HorusTerm() {
  // Create a ref to the Terminal and assign the Terminal type
  const term = React.createRef<Terminal>();

  useEffect(() => {
    function printTerm(data) {
      // Always convert to string
      data = data.toString();

      // Push the data to the terminal
      term.current?.pushToStdout(data);

      // Scroll to the bottom of the terminal
      term.current?.scrollToBottom();
    }

    // When recieving a message from the server, log it to the console
    socket.on("printTerm", printTerm);

    return () => {
      socket.off("printTerm", printTerm);
    };
  }, []);

  return (
    <div id="console-div" className="horus-term">
      <Terminal
        commands={getCommands()}
        promptLabel={"horus:~$"}
        ref={term}
        style={{
          border: "none",
          borderRadius: "0px",
          height: "100%",
        }}
      />
    </div>
  );
}
