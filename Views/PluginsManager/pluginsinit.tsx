import { useState, useEffect } from "react";
import RotatingLines from "../Components/RotatingLines/rotatinglines";
import { socket } from "../Utils/socket";
import { horusPost } from "../Utils/utils";

function PluginsInitView() {
  const [currentText, setCurrentText] = useState("");

  useEffect(() => {
    function updateText(data) {
      // Always convert to string
      data = data.toString();

      setCurrentText(data);
    }

    // When recieving a message from the server, log it to the console
    socket.on("initPlugin", updateText);

    return () => {
      socket.off("initPlugin", updateText);
    };
  }, []);

  useEffect(() => {
    // Send a request to the server to initialize the plugins
    horusPost("/initHorus", {}, {}).then((res) => {
      res.json().then((data) => {
        if (data.ok) {
          //   Redirect to the main page
          window.location.href = "/";
        } else {
          setCurrentText("Error initializing plugins." + data.error);
        }
      });
    });
  }, []);

  return (
    <div>
      <h1>Initializing plugins</h1>
      <RotatingLines />
      <div>{currentText}</div>
    </div>
  );
}

export default PluginsInitView;
