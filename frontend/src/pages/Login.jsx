import React, {useState} from 'react'
import api from '../utils/api'
import {useNavigate, Link} from 'react-router-dom'

export default function Login(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const navigate = useNavigate()

  async function doLogin(e){
    e.preventDefault()
    try{
      const res = await api.post('/auth/login', {email, password})
      if(res.data.ok){
        // store token and role
        localStorage.setItem('token', res.data.token)
        localStorage.setItem('role', res.data.role)
        
        // Redirect based on role
        if(res.data.role === 'teacher'){
          navigate('/teacher')
        } else if(res.data.role === 'student'){
          navigate('/student')
        } else {
          navigate('/student') // default fallback
        }
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
    <div style={{maxWidth: '400px', margin: '50px auto'}}>
      <div className="card">
        <h2 style={{textAlign: 'center', marginBottom: '30px'}}>Assignment Portal</h2>
        <h3 style={{textAlign: 'center', marginBottom: '20px', color: '#666'}}>Login</h3>
        <form onSubmit={doLogin}>
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
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginTop: '10px'}}>
            Login
          </button>
        </form>
        <div style={{textAlign: 'center', marginTop: '20px'}}>
          <p style={{color: '#666'}}>Don't have an account? <Link to="/register" style={{color: '#2f6fdb'}}>Register</Link></p>
        </div>
      </div>
    </div>
  )
}
