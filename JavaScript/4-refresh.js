'use strict';

const http = require('node:http');
const timers = require('node:timers/promises');
const connections = new Map();

const SERVER_PORT = 8000;
const LONG_RESPONSE = 60000;
const SHUTDOWN_TIMEOUT = 5000;
const HTTP_REFRESH = {
  'Content-Type': 'text/html',
  'Refresh': '5',
};

const server = http.createServer(async (req, res) => {
  console.log('New request');
  connections.set(res.connection, res);
  await timers.setTimeout(LONG_RESPONSE);
  res.end('Example output');
});

server.on('connection', (connection) => {
  console.log('New connection');
  connection.on('close', () => {
    console.log('Close');
    connections.delete(connection);
  });
});

server.listen(SERVER_PORT);

const showConnections = () => {
  console.log('Connection:', [...connections.values()].length);
  for (const connection of connections.keys()) {
    const { remoteAddress, remotePort } = connection;
    console.log(`  ${remoteAddress}:${remotePort}`);
  }
};

const closeConnections = async () => {
  for (const [connection, res] of connections.entries()) {
    connections.delete(connection);
    res.writeHead(503, HTTP_REFRESH);
    res.end('Service is unavailable');
    connection.destroy();
  }
};

const freeResources = async () => {
  console.log('Free resources');
};

const gracefulShutdown = async () => {
  server.close((error) => {
    if (error) {
      console.log(error);
      process.exit(1);
    }
  });
  await timers.setTimeout(SHUTDOWN_TIMEOUT);
  await freeResources();
  await closeConnections();
};

process.on('SIGINT', async () => {
  console.log();
  console.log('Graceful shutdown');
  showConnections();
  await gracefulShutdown();
  showConnections();
  console.log('Bye');
  process.exit(0);
});
