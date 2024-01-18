import React, { useEffect } from "react";
import { socket } from "../../Utils/socket";
import Terminal from "react-console-emulator";
import getCommands from "./commands";
import "./console.css";

// Setup the terminal

declare global {
  interface Window {
    horusTerm: {
      ref: React.RefObject<Terminal>;
      storedMessages: string[];
    };
  }
}

window.horusTerm = {
  ref: null,
  storedMessages: [],
};

// When recieving a message from the server, log it to the console
socket.on("printTerm", (data) => {
  window.horusTerm.storedMessages.push(data);
});

export default function HorusTerm() {
  // Create a ref to the Terminal and assign the Terminal type
  const term = React.createRef<Terminal>();

  function printTerm(data) {
    // Always convert to string
    data = data.toString();

    // Push the data to the terminal
    term.current?.pushToStdout(data);

    // Scroll to the bottom of the terminal
    term.current?.scrollToBottom();
  }

  // On first render, print all stored messages
  // When the component mounts, setup the socket
  useEffect(() => {
    // Set the ref
    window.horusTerm.ref = term;

    // Print all stored messages
    window.horusTerm.storedMessages?.forEach((message) => {
      printTerm(message);
    });

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
        promptLabel={"horus:~$ "}
        ref={term}
        style={{
          border: "none",
          borderRadius: "0px",
          height: "100%",
        }}
        disableOnProcess
        noDefaults
      />
    </div>
  );
}
