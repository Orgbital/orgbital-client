// import sharedb from "sharedb/lib/client";
// const WebSocket = require("ws");

// const ws = new WebSocket("ws://orgbital-server.azurewebsites.net");
// const conn = new sharedb.Connection(ws);

// const doc = conn.get('foo', 'bar');
// doc.fetch(function(err: any){
//     console.log(err);
// });

/*
**
**  Example of Interprocess communication in Node.js through a UNIX domain socket
**
**  Usage:
**   server>  MODE=server node ipc.example.js
**   client>  MODE=client node ipc.example.js
**
*/


const WebSocket = require("ws");
const axios = require('axios');
const sharedb = require("sharedb/lib/client")

const ws = new WebSocket("ws://localhost:8080");
const conn = new sharedb.Connection(ws);

const doc = conn.get('foo', 'bar');


var net = require('net'),
    fs = require('fs'),
    connections = {},
    server, client, mode
;

// prevent duplicate exit messages
var SHUTDOWN = false;

// Our socket
const SOCKETFILE = '/tmp/unix.sock';

// For simplicity of demonstration, both ends in this one file
switch(process.env["MODE"] || process.env["mode"]){
    case "server": mode = "server"; break;
    case "client": mode = "client"; break;
    default: console.error("Mode not set"); process.exit(1);
}

console.info('Loading interprocess communications test');
console.info('  Mode: %s \n  Socket: %s \n  Process: %s',mode,SOCKETFILE,process.pid);

function createServer(socket){
    console.log('Creating server.');
    var server = net.createServer(function(stream) {
        console.log('Connection acknowledged.');

        // Store all connections so we can terminate them if the server closes.
        // An object is better than an array for these.
        var self = Date.now();
        connections[self] = (stream);
        stream.on('end', function() {
            console.log('Client disconnected.');
            delete connections[self];
        });

        // Messages are buffers. use toString
        stream.on('data', function(msg) {
            msg = msg.toString();
            if (msg.startsWith("ahkuanisgod") && msg.endsWith("godisahkuan")) {
                realMsg = msg.substring("ahkuanisgod".length, msg.length-"godisahkuan".length)
                console.log("================")
                console.log(realMsg)
                console.log("================")
                // POST to /Collections/Documents/:collectionName

                axios.post('http://127.0.0.1:8080/Collections/Documents/swampert', {bufferContent: realMsg})
                     .then(function (res) {
                         console.log(res.data)
                         let id = res.data
                     })
                     .catch(function (error) {
                         console.log(error);
                     });            }
        });
    })
                    .listen(socket)
                    .on('connection', function(socket){
                        console.log('Client connected.');
                        console.log('Sending boop.');
                        socket.write('__boop');
                        //console.log(Object.keys(socket));
                    })
    ;
    return server;
}

if(mode === "server"){
    // check for failed cleanup
    console.log('Checking for leftover socket.');
    fs.stat(SOCKETFILE, function (err, stats) {
        if (err) {
            // start server
            console.log('No leftover socket found.');
            server = createServer(SOCKETFILE); return;
        }
        // remove file then start server
        console.log('Removing leftover socket.')
        fs.unlink(SOCKETFILE, function(err){
            if(err){
                // This should never happen.
                console.error(err); process.exit(0);
            }
            server = createServer(SOCKETFILE); return;
        });  
    });

    // close all connections when the user does CTRL-C
    function cleanup(){
        if(!SHUTDOWN){ SHUTDOWN = true;
                       console.log('\n',"Terminating.",'\n');
                       if(Object.keys(connections).length){
                           let clients = Object.keys(connections);
                           while(clients.length){
                               let client = clients.pop();
                               connections[client].write('__disconnect');
                               connections[client].end(); 
                           }
                       }
                       server.close();
                       process.exit(0);
                     }
    }
    process.on('SIGINT', cleanup);
}


if(mode === "client"){
    // Connect to server.
    console.log("Connecting to server.");
    client = net.createConnection(SOCKETFILE)
                .on('connect', ()=>{
                    console.log("Connected.");
                })
    // Messages are buffers. use toString
        .on('data', function(data) {
            data = data.toString();

            if(data === '__boop'){
                console.info('Server sent boop. Confirming our snoot is booped.');
                client.write('__snootbooped');
                return;
            }
            if(data === '__disconnect'){
                console.log('Server disconnected.')
                return cleanup();
            }

            // Generic message handler
            console.info('Server:', data)
        })
        .on('error', function(data) {
            console.error('Server not active.'); process.exit(1);
        })
    ;

    // Handle input from stdin.
    var inputbuffer = "";
    process.stdin.on("data", function (data) {
        inputbuffer += data;
        if (inputbuffer.indexOf("\n") !== -1) {
            var line = inputbuffer.substring(0, inputbuffer.indexOf("\n"));
            inputbuffer = inputbuffer.substring(inputbuffer.indexOf("\n") + 1);
            // Let the client escape
            if(line === 'exit'){ return cleanup(); }
            if(line === 'quit'){ return cleanup(); }
            client.write(line);
        }
    });

    function cleanup(){
        if(!SHUTDOWN){ SHUTDOWN = true;
                       console.log('\n',"Terminating.",'\n');
                       client.end();
                       process.exit(0);
                     }
    }
    process.on('SIGINT', cleanup);
}
