import React from 'react'
import ServerTab from './ServerTab'
import ClientTab from './ClientTab'
import TeacherTab from './TeacherTab'
import StudentTab from './StudentTab'

import {Link} from 'react-router-dom'

export default function TFTPMain(){
  const [tab, setTab] = React.useState('server')
  const token = localStorage.getItem('token')
  const [userRole, setUserRole] = React.useState(null)
  
  React.useEffect(() => {
    // Try to get role from token or localStorage
    if(token) {
      // Token format: token-username or token-email
      // We can't decode it, but we can check if user is logged in
      // For now, just check if token exists
      setUserRole('authenticated')
    }
  }, [token])

  function handleLogout(){
    localStorage.removeItem('token')
    setUserRole(null)
    window.location.reload()
  }

  return (
    <div className="tftp-main">
      <div style={{display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '20px', padding: '10px', backgroundColor: '#fff', borderRadius: '8px'}}>
        <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
          {token ? (
            <>
              <span style={{color: '#666'}}>Logged in</span>
              <button onClick={handleLogout} className="btn btn-secondary" style={{padding: '6px 12px'}}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-secondary" style={{textDecoration: 'none', padding: '6px 12px'}}>
                Login
              </Link>
              <Link to="/register" className="btn btn-primary" style={{textDecoration: 'none', padding: '6px 12px'}}>
                Register
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="tabs" style={{display: 'flex', gap: '8px', borderBottom: '2px solid #e3e6ee', marginBottom: '20px'}}>
        <button 
          onClick={() => setTab('server')} 
          className={tab==='server'? 'active': ''}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: tab==='server' ? '2px solid #2f6fdb' : '2px solid transparent',
            color: tab==='server' ? '#2f6fdb' : '#666',
            fontWeight: tab==='server' ? '600' : '400'
          }}
        >
          Server
        </button>
        <button 
          onClick={() => setTab('client')} 
          className={tab==='client'? 'active': ''}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: tab==='client' ? '2px solid #2f6fdb' : '2px solid transparent',
            color: tab==='client' ? '#2f6fdb' : '#666',
            fontWeight: tab==='client' ? '600' : '400'
          }}
        >
          Client
        </button>
        <button 
          onClick={() => setTab('teacher')} 
          className={tab==='teacher'? 'active': ''}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: tab==='teacher' ? '2px solid #2f6fdb' : '2px solid transparent',
            color: tab==='teacher' ? '#2f6fdb' : '#666',
            fontWeight: tab==='teacher' ? '600' : '400'
          }}
        >
          Teacher
        </button>
        <button 
          onClick={() => setTab('student')} 
          className={tab==='student'? 'active': ''}
          style={{
            padding: '10px 20px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            borderBottom: tab==='student' ? '2px solid #2f6fdb' : '2px solid transparent',
            color: tab==='student' ? '#2f6fdb' : '#666',
            fontWeight: tab==='student' ? '600' : '400'
          }}
        >
          Student
        </button>
      </div>
      <div className="tab-body">
        {tab === 'server' && <ServerTab/>}
        {tab === 'client' && <ClientTab/>}
        {tab === 'teacher' && <TeacherTab/>}
        {tab === 'student' && <StudentTab/>}
      </div>
    </div>
  )
}
