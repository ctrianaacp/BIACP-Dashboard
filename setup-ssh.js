const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const password = fs.readFileSync('vps_password.txt', 'utf8').split('\n')[1].trim();
const pubKeyPath = path.join(process.env.USERPROFILE, '.ssh', 'id_ed25519.pub');
const pubKey = fs.readFileSync(pubKeyPath, 'utf8').trim();

const conn = new Client();
conn.on('ready', () => {
  console.log('Client :: ready');
  conn.exec(`mkdir -p ~/.ssh && echo "${pubKey}" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log('Key installed successfully.');
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.error('STDERR: ' + data);
    });
  });
}).connect({
  host: '74.208.130.203',
  port: 22,
  username: 'root',
  password: password
});
