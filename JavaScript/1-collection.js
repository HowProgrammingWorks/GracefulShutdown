'use strict';

const http = require('http');
const connections = new Set();

const server = http.createServer((req, res) => {
  setTimeout(() => {
    res.end('Example output');
  }, 60000);
});

server.on('connection', connection => {
  connections.add(connection);
  connection.on('close', () => {
    connections.delete(connection);
  });
});

server.listen(8000);

const showConnection = () => {
  console.log('Connection:', [...connections.values()].length);
  for (const connection of connections.values()) {
    const { remoteAddress, remotePort } = connection;
    console.log(`  ${remoteAddress}:${remotePort}`);
  }
};

setInterval(showConnection, 1000);

const gracefulShutdown = callback => {
  server.close(callback);
  for (const connection of connections.values()) {
    connections.delete(connection);
    connection.destroy();
  }
};

process.on('SIGINT', () => {
  console.log();
  console.log('graceful shutdown');
  gracefulShutdown(() => {
    showConnection();
    console.log('bye');
    process.exit(0);
  });
});
