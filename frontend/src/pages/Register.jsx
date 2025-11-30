import React, {useState} from 'react'
import api from '../utils/api'
import {useNavigate} from 'react-router-dom'

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
    <div className="card">
      <h2>Register</h2>
      <form onSubmit={doRegister}>
        <label>Name</label>
        <input value={name} onChange={e=>setName(e.target.value)} />
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <label>Role</label>
        <select value={role} onChange={e=>setRole(e.target.value)}>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
        </select>
        {role === 'student' && (
          <label>Student ID / Roll Number</label>
        )}
        {role === 'student' && (
          <input 
            type="text" 
            value={studentId} 
            onChange={e=>setStudentId(e.target.value)} 
            placeholder="Enter your student ID"
          />
        )}
        <button type="submit">Register</button>
      </form>
    </div>
  )
}
