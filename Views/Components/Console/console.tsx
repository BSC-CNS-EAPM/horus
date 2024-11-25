// React
import { createRef, useEffect } from "react";

// Horus web-server
import { socket } from "../../Utils/socket";

// Terminal component
// @ts-ignore
import Terminal from "react-console-emulator";

// Terminal commands
import getCommands from "./commands";

// Styling to the console
import "./console.css";

// Setup the terminal
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
  const term = createRef<Terminal>();

  function printTerm(data: string | Buffer) {
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
    <div id="console-div" className="horus-term zoom-in-animation">
      <Terminal
        commands={getCommands()}
        promptLabel={"horus:~$ "}
        ref={term}
        style={{
          borderRadius: "0px",
          maxHeight: "15rem",
          minHeight: "15rem",
        }}
        disableOnProcess
        noDefaults
        autoFocus
      />
    </div>
  );
}
