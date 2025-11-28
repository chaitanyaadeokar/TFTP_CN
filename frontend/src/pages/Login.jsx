import React, {useState} from 'react'
import api from '../utils/api'
import {useNavigate} from 'react-router-dom'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  async function doLogin(e){
    e.preventDefault()
    try{
      const res = await api.post('/auth/login', {email, password})
      // store token and redirect based on role
      localStorage.setItem('token', res.data.token)
      const role = res.data.role || 'student'
      if(role === 'teacher') navigate('/teacher')
      else navigate('/student')
    }catch(err){
      alert('Login failed')
    }
  }

  return (
    <div className="card">
      <h2>Login</h2>
      <form onSubmit={doLogin}>
        <label>Email</label>
        <input value={email} onChange={e=>setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        <button type="submit">Login</button>
      </form>
    </div>
  )
}
