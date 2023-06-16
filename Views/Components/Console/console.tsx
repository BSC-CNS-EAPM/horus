import { io } from "socket.io-client";
import React, { useEffect } from "react";

import Terminal from "react-console-emulator";
import getCommands from "./commands";
import "./console.css";

export default function HorusTerm() {
  // Create a ref to the Terminal and assign the Terminal type
  const term = React.createRef<Terminal>();

  // Setup Socket.io
  const socket = io();

  // When recieving a message from the server, log it to the console
  socket.on("printTerm", (data) => {
    // Always convert to string
    data = data.toString();

    // Push the data to the terminal
    term.current?.pushToStdout(data);

    // Scroll to the bottom of the terminal
    term.current?.scrollToBottom();
  });

  return (
    <div id="console-div" className="horus-term">
      <Terminal
        commands={getCommands(socket)}
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
