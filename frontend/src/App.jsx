import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import AssignmentView from './pages/AssignmentView'

export default function App(){
  return (
    <div className="app">
      <header>
        <h1>TFTP Assignment Platform</h1>
        <nav>
          <Link to="/login">Login</Link> | <Link to="/register">Register</Link>
        </nav>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Login/>} />
          <Route path="/login" element={<Login/>} />
          <Route path="/register" element={<Register/>} />
          <Route path="/student" element={<StudentDashboard/>} />
          <Route path="/teacher" element={<TeacherDashboard/>} />
          <Route path="/assignment/:id" element={<AssignmentView/>} />
        </Routes>
      </main>
    </div>
  )
}
