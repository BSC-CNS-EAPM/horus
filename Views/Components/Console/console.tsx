import { io } from "socket.io-client";
import React, { useEffect } from 'react'

import Terminal from 'react-console-emulator'
import "./console.css";


export default function HorusTerm() {

    // Create a ref to the Terminal and assign the Terminal type
    const term = React.createRef<Terminal>();

    // Setup Socket.io
    const socket = io();

    // When recieving a message from the server, log it to the console
    socket.on('printTerm', (data) => {
        // Always convert to string
        data = data.toString();

        // Push the data to the terminal
        term.current?.pushToStdout(data);

        // Scroll to the bottom of the terminal
        term.current?.scrollToBottom();
    });

    const commands = {
        echo: {
            description: 'Echo a passed string.',
            usage: 'echo <string>',
            fn: (...args) => args.join(' ')
        },
        sendSocket: {
            description: 'Send a message to the server.',
            usage: 'sendSocket <string>',
            fn: (...args) => {
                socket.emit('message', args.join(' '));
            }
        },
    }

    return (
        <div id="console-div" className="horus-term" style={
            {
                display: "none"
            }
        }>
            <Terminal
                commands={commands}
                promptLabel={'horus:~$'}
                height={"200px"}
                ref={term}
                style={
                    {
                        maxHeight: "150px",
                        minHeight: "150px",
                        border: "none",
                        borderRadius: "0px",
                    }
                }
            />
        </div>
    )
}
