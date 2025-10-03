const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const si = require('systeminformation');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

app.get('/', (req, res) => res.send('malek-edex agent running'));

wss.on('connection', (ws) => {
  console.log('client connected');
  ws.send(JSON.stringify({ type: 'hello', msg: 'agent connected' }));

  const interval = setInterval(async () => {
    try {
      const cpu = await si.currentLoad();
      const mem = await si.mem();
      const network = await si.networkStats();

      const payload = {
        type: 'stats',
        cpu: Math.round(cpu.currentLoad),
        memPercent: Math.round((mem.used / mem.total) * 100),
        network: network[0] || {}
      };
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', error: e.toString() }));
    }
  }, 1000);

  ws.on('message', async (msg) => {
    const cmd = msg.toString().trim();
    if (cmd === 'sysinfo') {
      const osInfo = await si.osInfo();
      ws.send(JSON.stringify({ type: 'cmd', out: `${osInfo.distro} ${osInfo.release} ${osInfo.arch}` }));
    } else if (cmd === 'top') {
      const procs = await si.processes();
      const top = procs.list.sort((a,b)=>b.cpu-a.cpu).slice(0,5).map(p=>`${p.pid}\t${p.name}\t${p.cpu.toFixed(1)}%`).join('\n');
      ws.send(JSON.stringify({ type: 'cmd', out: top }));
    } else if (cmd.startsWith('echo ')) {
      ws.send(JSON.stringify({ type: 'cmd', out: cmd.slice(5) }));
    } else {
      ws.send(JSON.stringify({ type: 'cmd', out: 'Unknown command: '+cmd }));
    }
  });

  ws.on('close', () => clearInterval(interval));
});

server.listen(8081, () => console.log('Agent listening on http://localhost:8081'));
