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
      if(res.data.ok){
        // store token and redirect to main page
        localStorage.setItem('token', res.data.token)
        navigate('/tftp')
      } else {
        alert('Login failed: '+(res.data.error || 'Unknown error'))
      }
    }catch(err){
      const errorMsg = err.response?.data?.error || err.message || 'Connection failed'
      alert('Login failed: ' + errorMsg)
      console.error('Login error:', err)
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
