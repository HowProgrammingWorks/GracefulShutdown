'use strict';

const cluster = require('cluster');
const http = require('http');

const connections = new Map();
let server = null;
let child = null;

const SERVER_PORT = 8000;
const LONG_RESPONSE = 60000;
const SHUTDOWN_TIMEOUT = 5000;
const HTTP_REFRESH = {
  'Content-Type': 'text/html',
  'Refresh': '5',
};

const timeout = msec => new Promise(resolve => {
  setTimeout(resolve, msec);
});

const start = () => {
  console.log('Fork process');
  child = cluster.fork('./5-worker.js');
  child.on('message', message => {
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
  server.close(error => {
    console.log('Detach from HTTP listener');
    if (error) {
      console.log(error);
      process.exit(1);
    }
    process.exit(0);
  });
  await timeout(SHUTDOWN_TIMEOUT);
  await freeResources();
  await closeConnections();
};

if (cluster.isMaster) {
  start();

  process.on('SIGINT', async () => {
    child.send({ status: 'restart' });
  });
} else {
  server = http.createServer((req, res) => {
    console.log('New request');
    connections.set(res.connection, res);
    setTimeout(() => {
      res.end('Example output');
    }, LONG_RESPONSE);
  });

  server.on('connection', connection => {
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

  process.on('message', async message => {
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
