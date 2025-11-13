import React, {useState} from 'react'
import api from '../utils/api'
import {useNavigate} from 'react-router-dom'

export default function Register(){
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('student')
  const navigate = useNavigate()

  async function doRegister(e){
    e.preventDefault()
    try{
      await api.post('/auth/register', {name, email, password, role})
      alert('Registered')
      navigate('/login')
    }catch(err){
      alert('Registration failed')
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
        <button type="submit">Register</button>
      </form>
    </div>
  )
}
