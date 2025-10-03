import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Line } from "react-chartjs-2";
import './App.css';

function Stats({cpuHistory, mem}) {
  const data = {
    labels: cpuHistory.map((_,i)=>i),
    datasets: [{ label:'CPU %', data: cpuHistory, fill:false, tension:0.2, borderColor:'#5ee' }]
  };
  return (
    <div>
      <Line data={data}/>
      <div>Memory: {mem}%</div>
    </div>
  )
}

export default function App() {
  const termRef = useRef(null);
  const fit = useRef(null);
  const term = useRef(null);
  const [cpuHistory, setCpuHistory] = useState([]);
  const [memPercent, setMemPercent] = useState(0);
  const wsRef = useRef(null);

  useEffect(()=> {
    // init terminal
    term.current = new Terminal({cols:80, rows:18, cursorBlink:true});
    fit.current = new FitAddon();
    term.current.loadAddon(fit.current);
    term.current.open(termRef.current);
    fit.current.fit();
    term.current.writeln('Welcome to malek-edex (malek_alastal)');
    term.current.write('$ ');
    let cmdBuf = '';

    term.current.onData(e => {
      const code = e.charCodeAt(0);
      if (code === 13) {
        // send to agent
        if (wsRef.current && wsRef.current.readyState===WebSocket.OPEN) wsRef.current.send(cmdBuf);
        cmdBuf='';
        term.current.write('\r\n$ ');
      } else if (code===127) {
        if (cmdBuf.length>0) { cmdBuf=cmdBuf.slice(0,-1); term.current.write('\b \b'); }
      } else {
        cmdBuf += e;
        term.current.write(e);
      }
    });
    const onResize = ()=>fit.current.fit();
    window.addEventListener('resize',onResize);
    return ()=>window.removeEventListener('resize',onResize);
  }, []);

  useEffect(()=> {
    const ws = new WebSocket('ws://localhost:8081/ws');
    wsRef.current=ws;
    ws.onmessage=(ev)=> {
      const d = JSON.parse(ev.data);
      if (d.type==='stats'){
        setCpuHistory(prev=>[...prev.slice(-59),d.cpu]);
        setMemPercent(d.memPercent);
      } else if (d.type==='cmd'){
        term.current.write('\r\n'+d.out+'\r\n');
      } else if (d.type==='hello'){
        term.current.write('\r\n[agent] '+d.msg+'\r\n');
      }
    };
    return ()=>ws.close();
  }, []);

  return (
    <div className="container">
      <div className="left">
        <div ref={termRef} className="terminal"></div>
      </div>
      <div className="right">
        <h3>System Monitor</h3>
        <Stats cpuHistory={cpuHistory} mem={memPercent}/>
        <button onClick={()=>wsRef.current.send('top')}>Top</button>
        <button onClick={()=>wsRef.current.send('sysinfo')}>Sysinfo</button>
      </div>
    </div>
  )
}
