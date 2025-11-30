import React, {useEffect, useState} from 'react'
import api from '../utils/api'

export default function ServerTab(){
  const [host, setHost] = useState('0.0.0.0')
  const [port, setPort] = useState(6969)
  const [root, setRoot] = useState('')
  const [running, setRunning] = useState(false)
  const [listenPort, setListenPort] = useState(null)
  const [files, setFiles] = useState([])
  const [logs, setLogs] = useState('')
  const [streaming, setStreaming] = useState(false)
  const esRef = React.useRef(null)

  useEffect(()=>{ fetchFiles() }, [])
  // poll server status on mount
  useEffect(()=>{ getStatus() }, [])

  async function getStatus(){
    try{
      const res = await api.get('/server/status')
      if(res.data.ok){ setRunning(res.data.running); setListenPort(res.data.port) }
    }catch(err){ console.error(err) }
  }

  async function fetchFiles(){
    try{
      const res = await api.get('/files')
      if(res.data.ok) setFiles(res.data.files)
    }catch(err){ console.error(err) }
  }

  async function start(){
    try{
      const res = await api.post('/server/start', {host, port, root})
      if(res.data.ok){ setRunning(true); getStatus() }
    }catch(err){ alert('Start failed: '+err.message) }
  }

  async function stop(){
    try{
      const res = await api.post('/server/stop')
      if(res.data.ok) setRunning(false)
    }catch(err){ alert('Stop failed: '+err.message) }
  }

  async function fetchLogs(){
    try{
      const res = await api.get('/logs')
      if(res.data.ok) setLogs(res.data.logs.join('\n'))
    }catch(err){ console.error(err) }
  }

  function startLogStream(){
    if(esRef.current) return
    const url = '/api/logs/stream/server'
    const es = new EventSource(url)
    es.onmessage = (e) => {
      setLogs(prev => (prev ? prev + '\n' + e.data : e.data))
    }
    es.onerror = () => {
      es.close()
      esRef.current = null
      setStreaming(false)
    }
    esRef.current = es
    setStreaming(true)
  }

  function stopLogStream(){
    if(esRef.current){ esRef.current.close(); esRef.current = null }
    setStreaming(false)
  }

  return (
    <div className="server-tab">
      <div style={{display:'flex', gap:12}}>
        <label>Host: <input value={host} onChange={e=>setHost(e.target.value)} /></label>
        <label>Port: <input type="number" value={port} onChange={e=>setPort(Number(e.target.value))} /></label>
        <label>Root: <input value={root} onChange={e=>setRoot(e.target.value)} placeholder="server root path"/></label>
        <button onClick={start} disabled={running}>Start</button>
        <button onClick={stop} disabled={!running}>Stop</button>
        <button onClick={fetchFiles}>Refresh files</button>
        <button onClick={fetchLogs}>Load logs</button>
        {!streaming ? <button onClick={startLogStream}>Start Live Logs</button> : <button onClick={stopLogStream}>Stop Live Logs</button>}
      </div>

      <div style={{marginTop:8}}>
        <strong>Server status:</strong> {running ? <span style={{color:'green'}}>Running</span> : <span style={{color:'gray'}}>Stopped</span>} {listenPort ? <span> (listening on port {listenPort})</span> : null}
      </div>

      <h3>Files in Database</h3>
      <ul>
        {files.map(f=> <li key={f.filename}>{f.filename} ({f.size} bytes)</li>)}
      </ul>

      <h3>Server Logs</h3>
      <pre style={{background:'#111', color:'#eee', padding:10, maxHeight:400, overflow:'auto'}}>{logs}</pre>
    </div>
  )
}
