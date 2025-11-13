import React, {useEffect, useState} from 'react'
import api from '../utils/api'
import {Link} from 'react-router-dom'

export default function StudentDashboard(){
  const [assignments, setAssignments] = useState([])

  useEffect(()=>{
    async function load(){
      try{
        const res = await api.get('/assignments')
        setAssignments(res.data)
      }catch(err){
        // fallback sample data
        setAssignments([
          {id:1, title:'Assignment 1', subject:'Math', deadline:'2025-12-01'},
          {id:2, title:'Assignment 2', subject:'CS', deadline:'2025-12-15'}
        ])
      }
    }
    load()
  },[])

  return (
    <div>
      <h2>Student Dashboard</h2>
      <div className="grid">
        {assignments.map(a=> (
          <div className="card" key={a.id}>
            <h3>{a.title}</h3>
            <p>{a.subject}</p>
            <p>Deadline: {a.deadline}</p>
            <Link to={`/assignment/${a.id}`}>Open</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
