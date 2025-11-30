import React, {useEffect} from 'react'
import StudentTab from './StudentTab'
import {useNavigate} from 'react-router-dom'

export default function StudentDashboard(){
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
    if(role !== 'student'){
      alert('Access denied. Student access required.')
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
        <h1 style={{margin: 0, fontSize: '24px', fontWeight: '600'}}>Student Dashboard</h1>
        <button onClick={handleLogout} className="btn btn-secondary" style={{padding: '8px 16px'}}>
          Logout
        </button>
      </div>
      <StudentTab/>
    </div>
  )
}
