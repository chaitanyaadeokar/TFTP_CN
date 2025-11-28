import React, {useEffect, useState} from 'react'
import api from '../utils/api'
import {useParams} from 'react-router-dom'

export default function AssignmentView(){
  const {id} = useParams()
  const [assignment, setAssignment] = useState(null)
  const [file, setFile] = useState(null)
  const [log, setLog] = useState('')

  useEffect(()=>{
    async function load(){
      try{
        const res = await api.get(`/assignments/${id}`)
        setAssignment(res.data)
      }catch(err){
        setAssignment({id, title:'Assignment '+id, subject:'Sample', deadline:'2025-12-01', description:'Do this'})
      }
    }
    load()
  },[id])

  async function handleUpload(e){
    e.preventDefault()
    if(!file){ alert('Select file'); return }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('assignment_id', id)
    try{
      await api.post('/submissions', fd, {headers:{'Content-Type':'multipart/form-data'}})
      alert('Uploaded')
    }catch(err){
      alert('Upload failed')
    }
  }

  return (
    <div>
      <h2>Assignment {id}</h2>
      {assignment && (
        <div className="card">
          <h3>{assignment.title}</h3>
          <p>{assignment.subject} - Deadline: {assignment.deadline}</p>
          <p>{assignment.description}</p>
          <form onSubmit={handleUpload}>
            <input type="file" onChange={e=>setFile(e.target.files[0])} />
            <button type="submit">Upload</button>
          </form>
        </div>
      )}
    </div>
  )
}
