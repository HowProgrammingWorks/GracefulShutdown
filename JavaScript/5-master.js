'use strict';

const cp = require('child_process');

let child = null;

const start = () => {
  console.log('Fork process');
  child = cp.fork('./5-worker.js');
  child.on('message', message => {
    if (message.status === 'restarted') {
      console.log('Restart worker');
      start();
    }
  });
};

start();

process.on('SIGINT', async () => {
  child.send({ status: 'restart' });
});
