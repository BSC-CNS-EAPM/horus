import { Socket } from 'socket.io-client';

export default function getCommands(socket: Socket){
    return {
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
        sel: {
            description: 'Select a residue.',
            usage: 'sel <residue>',
            fn: (...args) => {
                // Select the residue
                console.log(args);
            }
        }
    }
}