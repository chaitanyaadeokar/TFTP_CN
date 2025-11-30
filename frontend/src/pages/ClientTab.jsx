import React, {useEffect, useState, useRef} from 'react'
import api from '../utils/api'

export default function ClientTab(){
  const [files, setFiles] = useState([])
  const [selected, setSelected] = useState('')
  const [host, setHost] = useState('127.0.0.1')
  const [port, setPort] = useState(69)
  const [progress, setProgress] = useState(0)
  const [clientLogs, setClientLogs] = useState('')
  const [clientStreaming, setClientStreaming] = useState(false)
  const clientEs = useRef(null)
  const fileInput = useRef()

  useEffect(()=>{ fetchFiles() }, [])

  async function fetchFiles(){
    try{
      const res = await api.get('/files')
      if(res.data.ok) setFiles(res.data.files)
    }catch(err){ console.error(err) }
  }

  function startClientLogStream(){
    if(clientEs.current) return
    const es = new EventSource('/api/logs/stream/client')
    es.onmessage = (e) => setClientLogs(prev => (prev ? prev + '\n' + e.data : e.data))
    es.onerror = () => { es.close(); clientEs.current = null; setClientStreaming(false) }
    clientEs.current = es
    setClientStreaming(true)
  }

  function stopClientLogStream(){
    if(clientEs.current){ clientEs.current.close(); clientEs.current = null }
    setClientStreaming(false)
  }

  async function download(){
    if(!selected) return alert('Select a filename')
    setProgress(0)
    try{
      const res = await fetch(`/api/download`, {
        method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({filename: selected, host, port})
      })
      if(!res.ok) throw new Error('Download failed')
      const reader = res.body.getReader()
      const contentLength = +res.headers.get('Content-Length') || 0
      let received = 0
      const chunks = []
      while(true){
        const {done, value} = await reader.read()
        if(done) break
        chunks.push(value)
        received += value.length
        if(contentLength) setProgress(Math.round((received/contentLength)*100))
      }
      const blob = new Blob(chunks)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = selected
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setProgress(100)
    }catch(err){ alert('Download error: '+err.message) }
  }

  async function upload(){
    const file = fileInput.current.files[0]
    if(!file) return alert('Select file to upload')
    const form = new FormData()
    form.append('file', file)
    form.append('host', host)
    form.append('port', port)
    try{
      // Let the browser set the multipart boundary header
      const res = await api.post('/upload', form)
      if(res.data.ok) alert('Upload complete')
      else alert('Upload failed: '+res.data.error)
    }catch(err){ alert('Upload error: '+(err.response?.data?.error || err.message)) }
  }

  return (
    <div className="client-tab">
      <div style={{display:'flex', gap:12}}>
        <label>Server: <input value={host} onChange={e=>setHost(e.target.value)} /></label>
        <label>Port: <input type="number" value={port} onChange={e=>setPort(Number(e.target.value))} /></label>
        <label>Filename: 
          <input list="files" value={selected} onChange={e=>setSelected(e.target.value)} placeholder="Select or type name" />
          <datalist id="files">
            {files.map(f=> <option key={f.filename} value={f.filename} />)}
          </datalist>
        </label>
        <button onClick={download}>Download</button>
      </div>

      <div style={{marginTop:12}}>
        <label>Upload file: <input type="file" ref={fileInput} /></label>
        <button onClick={upload}>Upload</button>
      </div>

      <div style={{marginTop:12}}>
        <label>Progress:</label>
        <progress value={progress} max={100} style={{width:'100%'}} /> {progress}%
      </div>

      <h4>Available files</h4>
      <ul>
        {files.map(f=> <li key={f.filename}>{f.filename} ({f.size} bytes)</li>)}
      </ul>

      <h4>Client Logs</h4>
      <div style={{display:'flex', gap:8}}>
        {!clientStreaming ? <button onClick={startClientLogStream}>Start Live Client Logs</button> : <button onClick={stopClientLogStream}>Stop Live Client Logs</button>}
        <button onClick={() => setClientLogs('')}>Clear</button>
      </div>
      <pre style={{background:'#111', color:'#eee', padding:10, maxHeight:300, overflow:'auto'}}>{clientLogs}</pre>
    </div>
  )
}
