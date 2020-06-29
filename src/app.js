const WebSocket = require("ws");
const axios = require('axios');
const sharedb = require("sharedb/lib/client")

// Temp variable for development
const collectionName = 'swampert';

const mode = 'server';
let doc = undefined;

var net = require('net'),
  fs = require('fs'),
  connections = {},
  server, client;

// prevent duplicate exit messages
var SHUTDOWN = false;

// Our socket
const SOCKETFILE = '/tmp/unix.sock';

console.info('Loading interprocess communications test');
console.info('  Mode: %s \n  Socket: %s \n  Process: %s', mode, SOCKETFILE, process.pid);

function jsonToArray(json) {
  const str = JSON.stringify(json, null, 0);
  let ret = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    ret[i] = str.charCodeAt(i);
  }
  return ret
}

function createServer (socket) {
  console.log('Creating server.');
  var server = net.createServer(function (stream) {
    console.log('Connection acknowledged.');

    // Store all connections so we can terminate them if the server closes.
    // An object is better than an array for these.
    var self = Date.now();
    connections[self] = (stream);
    stream.on('end', function () {
      console.log('Client disconnected.');
      delete connections[self];
    });

    // Messages are buffers. use toString
    stream.on('data', function (msg) {
      msg = msg.toString();
      if (msg.startsWith("ahkuanisgod") && msg.endsWith("godisahkuan")) {
        const bufferContent = msg.substring("ahkuanisgod".length, msg.length - "godisahkuan".length)

        // POST to /Collections/Documents/:collectionName
        axios.post(`http://127.0.0.1:8080/Collections/Documents/${collectionName}`, {
          "orgbital.el": bufferContent // TODO Remove hardcode
        }).then(function (res) {
          // The POST request returns the ID of the buffer. We
          // then establish a ws connection to the server, and
          // retrieve this document.
          let documentId = res.data;

          const ws = new WebSocket("ws://localhost:8080/ws");
          const conn = new sharedb.Connection(ws);

          // fetch doc, and display its contents
          doc = conn.get(collectionName, documentId);
          doc.fetch(err => {
            if (err) {
              throw err;
            } else {
              console.log(doc.data);
            }
          })

          doc.on('op', (op, source) => {
            console.log('op');
            console.log(op);
            // if (!source) { // op was received from server
              // TODO: send
              const arr = jsonToArray(op);
              console.log(arr);
              stream.write(arr);
            // } else {
            //   console.log('!source');
            // }
          })
        })
          .catch(function (error) {
            console.log(error);
          });
      } else if (msg.startsWith("fsp") && msg.endsWith("fsp")) { // it's an op
        const opStr = msg.substring(
          "fsp".length,
          msg.length - "fsp".length);
        console.log(opStr);
        let op;
        try {
          op = JSON.parse(opStr);
          console.log(op);
        } catch (e) {
          console.error(e);
        }
        if (op.o[0].i) { // it's an insert op
          doc.submitOp(op, console.error);
        } else { // it's a delete op
          // TODO: We need to retrieve the region to delete, as I can't find it
          // in Emacs :(
          // doc.data;
          const contentToDelete = 'TODO';
          op.o[0].d = contentToDelete;
          doc.submitOp(op, console.error);
        }
      }
    });
  })
    .listen(socket)
    .on('connection', function (socket) {
      console.log('Client connected.');
      console.log('Sending boop.');
      socket.write('__boop');
      //console.log(Object.keys(socket));
    })
    ;
  return server;
}

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
  fs.unlink(SOCKETFILE, function (err) {
    if (err) {
      // This should never happen.
      console.error(err); process.exit(0);
    }
    server = createServer(SOCKETFILE); return;
  });
});

// close all connections when the user does CTRL-C
function cleanup () {
  if (!SHUTDOWN) {
    SHUTDOWN = true;
    console.log('\n', "Terminating.", '\n');
    if (Object.keys(connections).length) {
      let clients = Object.keys(connections);
      while (clients.length) {
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
