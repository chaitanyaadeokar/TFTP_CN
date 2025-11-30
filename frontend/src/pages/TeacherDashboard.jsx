import React, {useEffect} from 'react'
import TeacherTab from './TeacherTab'
import {useNavigate} from 'react-router-dom'

export default function TeacherDashboard(){
  const navigate = useNavigate()
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')

  useEffect(() => {
    // Check authentication
    if(!token){
      navigate('/login')
      return
    }
    // Check role
    if(role !== 'teacher'){
      alert('Access denied. Teacher access required.')
      navigate('/login')
      return
    }
  }, [token, role, navigate])

  function handleLogout(){
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    navigate('/login')
  }

  return (
    <div>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', padding: '15px 20px', backgroundColor: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'}}>
        <h1 style={{margin: 0, fontSize: '24px', fontWeight: '600'}}>Teacher Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-secondary" style={{padding: '8px 16px'}}>
          Logout
        </button>
      </div>
      <TeacherTab/>
    </div>
  )
}
