'use strict';

const cluster = require('node:cluster');
const timers = require('node:timers/promises');
const http = require('node:http');

const connections = new Map();
let server = null;
let child = null;

const SERVER_PORT = 8000;
const LONG_RESPONSE = 60000;
const SHUTDOWN_TIMEOUT = 5000;
const HTTP_REFRESH = {
  'Content-Type': 'text/html',
  Refresh: '5',
};

const start = () => {
  console.log('Fork process');
  child = cluster.fork('./5-cluster.js');
  child.on('message', (message) => {
    if (message.status === 'restarted') {
      console.log('Restart worker');
      start();
    }
  });
};

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
  process.send({ status: 'restarted' });
  server.close((error) => {
    console.log('Detach from HTTP listener');
    if (error) {
      console.log(error);
      process.exit(1);
    }
    process.exit(0);
  });
  await timers.setTimeout(SHUTDOWN_TIMEOUT);
  await freeResources();
  await closeConnections();
};

if (cluster.isPrimary) {
  start();

  process.on('SIGINT', async () => {
    child.send({ status: 'restart' });
  });
} else {
  server = http.createServer(async (req, res) => {
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
  server.on('listening', () => {
    console.log('Attach to HTTP listener');
  });

  process.on('message', async (message) => {
    if (message.status === 'restart') {
      console.log();
      console.log('Graceful shutdown');
      showConnections();
      await gracefulShutdown();
      showConnections();
      console.log('Worker exited');
    }
  });

  process.on('SIGINT', () => {});
}
