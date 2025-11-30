import React, {useState} from 'react'
import api from '../utils/api'
import {useNavigate, Link} from 'react-router-dom'

export default function Register(){
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const [studentId, setStudentId] = useState('')
  const navigate = useNavigate()

  async function doRegister(e){
    e.preventDefault()
    if(!name || !email || !password){
      alert('Please fill in all required fields')
      return
    }
    if(role === 'student' && !studentId){
      alert('Please enter your Student ID')
      return
    }
    try{
      const res = await api.post('/auth/register', {
        name, 
        email, 
        password, 
        role,
        student_id: role === 'student' ? studentId : undefined
      })
      if(res.data.ok){
        alert('Registered successfully! Please login.')
        navigate('/login')
      } else {
        alert('Registration failed: '+(res.data.error||'unknown error'))
      }
    }catch(err){
      const errorMsg = err.response?.data?.error || err.message || 'Connection failed'
      alert('Registration failed: ' + errorMsg)
      console.error('Registration error:', err)
    }
  }

  return (
    <div style={{maxWidth: '400px', margin: '50px auto'}}>
      <div className="card">
        <h2 style={{textAlign: 'center', marginBottom: '30px'}}>Assignment Portal</h2>
        <h3 style={{textAlign: 'center', marginBottom: '20px', color: '#666'}}>Register</h3>
        <form onSubmit={doRegister}>
          <label>Name</label>
          <input value={name} onChange={e=>setName(e.target.value)} required />
          <label>Email</label>
          <input 
            type="email"
            value={email} 
            onChange={e=>setEmail(e.target.value)}
            required
          />
          <label>Password</label>
          <input 
            type="password" 
            value={password} 
            onChange={e=>setPassword(e.target.value)}
            required
          />
          <label>Role</label>
          <select value={role} onChange={e=>setRole(e.target.value)}>
            <option value="student">Student</option>
            <option value="teacher">Teacher</option>
          </select>
          {role === 'student' && (
            <>
              <label>Student ID / Roll Number</label>
              <input 
                type="text" 
                value={studentId} 
                onChange={e=>setStudentId(e.target.value)}
                placeholder="Enter your student ID"
                required
              />
            </>
          )}
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '10px'}}>
            Register
          </button>
        </form>
        <div style={{textAlign: 'center', marginTop: '20px'}}>
          <p style={{color: '#666'}}>Already have an account? <Link to="/login" style={{color: '#2f6fdb'}}>Login</Link></p>
        </div>
      </div>
    </div>
  )
}
