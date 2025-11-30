import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Login from './pages/Login'
import Register from './pages/Register'
import StudentDashboard from './pages/StudentDashboard'
import TeacherDashboard from './pages/TeacherDashboard'
import AssignmentView from './pages/AssignmentView'
import TFTPMain from './pages/TFTPMain'

export default function App(){
  return (
    <div className="app">
      <header>
        <h1>TFTP Client Server</h1>
      </header>
      <main>
        <Routes>
          <Route path="/" element={<TFTPMain/>} />
          <Route path="/tftp" element={<TFTPMain/>} />
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
            <Route path="/tftp" element={<TFTPMain/>} />
