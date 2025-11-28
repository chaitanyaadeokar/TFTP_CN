import React, {useEffect, useState} from 'react'
import api from '../utils/api'
import {Link} from 'react-router-dom'

export default function TeacherDashboard(){
  const [assignments, setAssignments] = useState([])

  useEffect(()=>{
    async function load(){
      try{
        const res = await api.get('/assignments')
        setAssignments(res.data)
      }catch(err){
        setAssignments([
          {id:1, title:'Assignment 1', subject:'Math', submissions:5},
          {id:2, title:'Assignment 2', subject:'CS', submissions:2}
        ])
      }
    }
    load()
  },[])

  return (
    <div>
      <h2>Teacher Dashboard</h2>
      <div className="grid">
        {assignments.map(a=> (
          <div className="card" key={a.id}>
            <h3>{a.title}</h3>
            <p>{a.subject}</p>
            <p>Submissions: {a.submissions || 0}</p>
            <Link to={`/assignment/${a.id}`}>Manage</Link>
          </div>
        ))}
      </div>
    </div>
  )
}
