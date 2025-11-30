import React, {useEffect, useState} from 'react'
import api from '../utils/api'
import mammoth from 'mammoth'

export default function TeacherTab(){
  const [assignments, setAssignments] = useState([])
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState(null)
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subject: '',
    deadline: ''
  })
  const [selectedSubject, setSelectedSubject] = useState('all')
  const [subjects, setSubjects] = useState([])
  const [viewMode, setViewMode] = useState('submissions') // 'submissions' or 'students'
  const [allStudents, setAllStudents] = useState([])
  const [previewFile, setPreviewFile] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [docxHtml, setDocxHtml] = useState('')
  const [textContent, setTextContent] = useState('')

  useEffect(() => {
    fetchAssignments()
    fetchSubjects()
  }, [])

  useEffect(() => {
    if(selectedAssignment) {
      if(viewMode === 'submissions') {
        fetchSubmissions(selectedAssignment.id)
      } else {
        fetchSubmissions(selectedAssignment.id) // Fetch submissions first so we can download
        fetchAllStudents(selectedAssignment.id)
      }
    }
  }, [selectedAssignment, viewMode])

  async function fetchAssignments(){
    try{
      const res = await api.get('/assignments')
      if(res.data.ok) {
        setAssignments(res.data.assignments)
        // Always extract unique subjects from assignments
        const uniqueSubjects = [...new Set(res.data.assignments
          .filter(a => a.subject && a.subject.trim())
          .map(a => a.subject.trim()))]
        if(uniqueSubjects.length > 0) {
          setSubjects(prev => {
            const combined = [...new Set([...prev, ...uniqueSubjects])]
            return combined.sort()
          })
        }
      }
    }catch(err){
      console.error('Failed to fetch assignments:', err)
      alert('Failed to load assignments')
    }
  }

  async function fetchSubmissions(assignmentId){
    try{
      const res = await api.get(`/assignments/${assignmentId}/submissions`)
      if(res.data.ok) setSubmissions(res.data.submissions)
    }catch(err){
      console.error('Failed to fetch submissions:', err)
      setSubmissions([])
    }
  }

  async function fetchSubjects(){
    try{
      const res = await api.get('/subjects')
      if(res.data.ok && res.data.subjects && res.data.subjects.length > 0) {
        setSubjects(res.data.subjects)
      }
      // Always also extract from assignments as fallback/update
      if(assignments.length > 0) {
        const uniqueSubjects = [...new Set(assignments
          .filter(a => a.subject && a.subject.trim())
          .map(a => a.subject.trim()))]
        if(uniqueSubjects.length > 0) {
          setSubjects(prev => {
            const combined = [...new Set([...prev, ...uniqueSubjects])]
            return combined.sort()
          })
        }
      }
    }catch(err){
      console.error('Failed to fetch subjects:', err)
      // Fallback: extract unique subjects from assignments
      if(assignments.length > 0) {
        const uniqueSubjects = [...new Set(assignments
          .filter(a => a.subject && a.subject.trim())
          .map(a => a.subject.trim()))]
        setSubjects(uniqueSubjects.sort())
      }
    }
  }

  async function fetchAllStudents(assignmentId){
    try{
      const res = await api.get(`/assignments/${assignmentId}/students`)
      if(res.data.ok && res.data.students) {
        // Sort students by student_id (roll number) - handle null/empty values
        const sortedStudents = res.data.students.sort((a, b) => {
          const idA = a.student_id || ''
          const idB = b.student_id || ''
          // If both have IDs, compare them (handle numeric and string IDs)
          if(idA && idB) {
            // Try numeric comparison first
            const numA = parseInt(idA)
            const numB = parseInt(idB)
            if(!isNaN(numA) && !isNaN(numB)) {
              return numA - numB
            }
            // Otherwise string comparison
            return idA.localeCompare(idB)
          }
          // If one has ID and other doesn't, prioritize the one with ID
          if(idA && !idB) return -1
          if(!idA && idB) return 1
          // If neither has ID, sort by user ID
          return a.id - b.id
        })
        setAllStudents(sortedStudents)
      } else {
        console.error('No students returned or invalid response:', res.data)
        setAllStudents([])
      }
    }catch(err){
      console.error('Failed to fetch students:', err)
      console.error('Error details:', err.response?.data)
      setAllStudents([])
    }
  }

  async function createAssignment(e){
    e.preventDefault()
    try{
      const res = await api.post('/assignments', formData)
      if(res.data.ok){
        alert('Assignment created successfully')
        setShowCreateForm(false)
        setFormData({title: '', description: '', subject: '', deadline: ''})
        fetchAssignments()
        fetchSubjects()
      }
    }catch(err){
      alert('Failed to create assignment: ' + (err.response?.data?.error || err.message))
    }
  }

  async function updateAssignment(e){
    e.preventDefault()
    try{
      const res = await api.put(`/assignments/${editingAssignment.id}`, formData)
      if(res.data.ok){
        alert('Assignment updated successfully')
        setEditingAssignment(null)
        setFormData({title: '', description: '', subject: '', deadline: ''})
        fetchAssignments()
        fetchSubjects()
        if(selectedAssignment?.id === editingAssignment.id){
          setSelectedAssignment(res.data.assignment)
        }
      }
    }catch(err){
      alert('Failed to update assignment: ' + (err.response?.data?.error || err.message))
    }
  }

  async function deleteAssignment(id){
    if(!confirm('Are you sure you want to delete this assignment?')) return
    try{
      const res = await api.delete(`/assignments/${id}`)
      if(res.data.ok){
        alert('Assignment deleted')
        fetchAssignments()
        if(selectedAssignment?.id === id){
          setSelectedAssignment(null)
          setSubmissions([])
        }
      }
    }catch(err){
      alert('Failed to delete assignment: ' + (err.response?.data?.error || err.message))
    }
  }

  async function downloadSubmission(submissionId, filename){
    try{
      const res = await fetch(`/api/submissions/${submissionId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if(!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }catch(err){
      alert('Failed to download: ' + err.message)
    }
  }

  async function viewSubmission(submissionId, filename){
    setPreviewLoading(true)
    setPreviewFile({id: submissionId, filename: filename})
    try{
      const res = await fetch(`/api/submissions/${submissionId}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      if(!res.ok) throw new Error('Failed to load file')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setPreviewFile({id: submissionId, filename: filename, url: url, blob: blob})
    }catch(err){
      alert('Failed to load file: ' + err.message)
      setPreviewFile(null)
    }finally{
      setPreviewLoading(false)
    }
  }

  function closePreview(){
    if(previewFile?.url){
      URL.revokeObjectURL(previewFile.url)
    }
    setPreviewFile(null)
  }

  function getFileType(filename){
    const ext = filename.split('.').pop().toLowerCase()
    const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg']
    const textTypes = ['txt', 'md', 'json', 'xml', 'csv', 'log']
    const codeTypes = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'html', 'css', 'php', 'rb', 'go']
    
    if(imageTypes.includes(ext)) return 'image'
    if(textTypes.includes(ext) || codeTypes.includes(ext)) return 'text'
    if(ext === 'pdf') return 'pdf'
    if(ext === 'docx') return 'docx'
    return 'unsupported'
  }

  function renderPreview(){
    if(!previewFile || !previewFile.url) return null
    
    const fileType = getFileType(previewFile.filename)
    
    return (
      <div className="modal-overlay" onClick={closePreview}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{previewFile.filename}</h3>
            <button className="modal-close" onClick={closePreview}>×</button>
          </div>
          <div className="modal-body">
            {previewLoading ? (
              <div style={{textAlign: 'center', padding: '40px'}}>
                <div style={{fontSize: '18px', color: '#666'}}>Loading preview...</div>
              </div>
            ) : fileType === 'image' ? (
              <img src={previewFile.url} alt={previewFile.filename} className="file-preview" />
            ) : fileType === 'pdf' ? (
              <iframe 
                src={previewFile.url + '#toolbar=1'} 
                className="file-preview" 
                title={previewFile.filename}
                style={{width: '100%', minHeight: '600px', border: 'none', borderRadius: '8px'}}
                type="application/pdf"
              />
            ) : fileType === 'docx' ? (
              <div 
                className="file-preview" 
                style={{width: '100%', padding: '20px', overflow: 'auto', maxHeight: '70vh'}}
                dangerouslySetInnerHTML={{__html: docxHtml || 'Loading DOCX content...'}}
              />
            ) : fileType === 'text' ? (
              <pre className="file-preview">
                <code>{textContent || 'Loading text content...'}</code>
              </pre>
            ) : (
              <div className="file-preview-unsupported">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                </svg>
                <p>Preview not available for this file type</p>
                <p style={{fontSize: '14px', marginTop: '8px'}}>Please download to view</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Load text file content for preview
  React.useEffect(() => {
    if(previewFile && previewFile.url && getFileType(previewFile.filename) === 'text'){
      setTextContent('Loading...')
      fetch(previewFile.url)
        .then(res => res.text())
        .then(text => {
          setTextContent(text)
        })
        .catch(err => {
          console.error('Failed to load text:', err)
          setTextContent('Failed to load file content')
        })
    } else {
      setTextContent('')
    }
  }, [previewFile])

  // Load DOCX file content for preview
  React.useEffect(() => {
    if(previewFile && previewFile.blob && getFileType(previewFile.filename) === 'docx'){
      setDocxHtml('Loading DOCX content...')
      previewFile.blob.arrayBuffer()
        .then(arrayBuffer => mammoth.convertToHtml({arrayBuffer: arrayBuffer}))
        .then(result => {
          setDocxHtml(result.value)
        })
        .catch(err => {
          console.error('Failed to load DOCX:', err)
          setDocxHtml('<div style="padding: 20px; text-align: center; color: #d32f2f;"><p>Failed to load DOCX content</p><p style="font-size: 14px; color: #666;">Please download to view</p></div>')
        })
    } else {
      setDocxHtml('')
    }
  }, [previewFile])

  function handleEdit(assignment){
    setEditingAssignment(assignment)
    setFormData({
      title: assignment.title,
      description: assignment.description || '',
      subject: assignment.subject || '',
      deadline: assignment.deadline.split('T')[0] + 'T' + (assignment.deadline.split('T')[1] || '23:59').substring(0, 5)
    })
    setShowCreateForm(true)
  }

  function cancelForm(){
    setShowCreateForm(false)
    setEditingAssignment(null)
    setFormData({title: '', description: '', subject: '', deadline: ''})
  }

  const filteredAssignments = selectedSubject === 'all' 
    ? assignments 
    : assignments.filter(a => a.subject === selectedSubject)

  const now = new Date()
  const formatDeadline = (deadline) => {
    const d = new Date(deadline)
    return d.toLocaleString()
  }

  const isPastDeadline = (deadline) => {
    return new Date(deadline) < now
  }

  const extractOriginalFilename = (filename) => {
    if(!filename) return 'File'
    // Pattern: assignment_{id}_{user_id}_{timestamp}_{original}
    if(filename.startsWith('assignment_')) {
      const parts = filename.split('_')
      if(parts.length >= 5) {
        // Return everything after the timestamp (4th part)
        return parts.slice(4).join('_')
      }
    }
    return filename
  }

  return (
    <div className="teacher-tab">
      {previewFile && renderPreview()}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'rgba(255,255,255,0.95)', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}>
        <h2 style={{margin: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '28px', fontWeight: '700'}}>
          📚 Teacher Portal
        </h2>
        <button 
          onClick={() => {setShowCreateForm(true); setEditingAssignment(null); setFormData({title: '', description: '', subject: '', deadline: ''})}}
          className="btn btn-primary"
          style={{fontSize: '16px', padding: '12px 24px'}}
        >
          ➕ Create Assignment
        </button>
      </div>

      {showCreateForm && (
        <div className="card" style={{marginBottom: '24px', background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.95) 100%)'}}>
          <h3 style={{marginTop: 0, color: '#667eea', fontSize: '22px', fontWeight: '600'}}>
            {editingAssignment ? '✏️ Edit Assignment' : '✨ Create New Assignment'}
          </h3>
          <form onSubmit={editingAssignment ? updateAssignment : createAssignment}>
            <label>Title *</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={e => setFormData({...formData, title: e.target.value})}
              required
            />
            <label>Subject</label>
            <input 
              type="text" 
              value={formData.subject} 
              onChange={e => setFormData({...formData, subject: e.target.value})}
              placeholder="e.g., Math, CS, Physics"
            />
            <label>Description</label>
            <textarea 
              value={formData.description} 
              onChange={e => setFormData({...formData, description: e.target.value})}
              rows="4"
              style={{width: '100%', padding: '8px', margin: '6px 0', boxSizing: 'border-box'}}
            />
            <label>Deadline *</label>
            <input 
              type="datetime-local" 
              value={formData.deadline} 
              onChange={e => setFormData({...formData, deadline: e.target.value})}
              required
            />
            <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
              <button type="submit" className="btn btn-primary">
                {editingAssignment ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={cancelForm} className="btn btn-secondary">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
        <div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'rgba(255,255,255,0.95)', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'}}>
            <h3 style={{margin: 0, fontSize: '20px', fontWeight: '600', color: '#333'}}>
              📋 Assignments ({filteredAssignments.length})
            </h3>
            <select 
              value={selectedSubject} 
              onChange={e => setSelectedSubject(e.target.value)}
              style={{padding: '10px 16px', borderRadius: '8px', border: '2px solid #e3e6ee', fontSize: '14px', fontWeight: '500', cursor: 'pointer', minWidth: '180px'}}
            >
              <option value="all">📚 All Subjects</option>
              {subjects.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div style={{maxHeight: '600px', overflowY: 'auto'}}>
            {filteredAssignments.length === 0 ? (
              <p>No assignments yet. Create one to get started.</p>
            ) : (
              filteredAssignments.map(a => (
                <div 
                  key={a.id} 
                  className="card" 
                  style={{
                    marginBottom: '10px',
                    cursor: 'pointer',
                    border: selectedAssignment?.id === a.id ? '3px solid #667eea' : '2px solid rgba(255,255,255,0.3)',
                    backgroundColor: selectedAssignment?.id === a.id ? 'rgba(102,126,234,0.1)' : 'rgba(255,255,255,0.98)',
                    transition: 'all 0.3s'
                  }}
                  onClick={() => setSelectedAssignment(a)}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                    <div style={{flex: 1}}>
                      <h4 style={{margin: '0 0 10px 0', fontSize: '18px', fontWeight: '600', color: '#333'}}>
                        📝 {a.title}
                      </h4>
                      {a.subject && (
                        <p style={{margin: '6px 0', fontSize: '0.9em', color: '#667eea', fontWeight: '500'}}>
                          📚 Subject: <strong>{a.subject}</strong>
                        </p>
                      )}
                      <p style={{margin: '6px 0', fontSize: '0.95em', color: '#555'}}>
                        ⏰ Deadline: <strong style={{color: isPastDeadline(a.deadline) ? '#d32f2f' : '#667eea'}}>
                          {formatDeadline(a.deadline)}
                        </strong>
                        {isPastDeadline(a.deadline) && <span style={{color: '#d32f2f', marginLeft: '4px'}}> (Past)</span>}
                      </p>
                      <p style={{margin: '6px 0', fontSize: '0.9em', color: '#888'}}>
                        📊 Submissions: <strong style={{color: '#667eea'}}>{a.submission_count || 0}</strong>
                      </p>
                      {a.description && (
                        <p style={{margin: '8px 0 0 0', fontSize: '0.9em', color: '#555'}}>
                          {a.description.substring(0, 100)}{a.description.length > 100 ? '...' : ''}
                        </p>
                      )}
                    </div>
                    <div style={{display: 'flex', gap: '5px', flexDirection: 'column'}}>
                      <button 
                        onClick={(e) => {e.stopPropagation(); handleEdit(a)}}
                        className="btn btn-secondary"
                        style={{fontSize: '0.85em', padding: '4px 8px'}}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={(e) => {e.stopPropagation(); deleteAssignment(a.id)}}
                        className="btn btn-secondary"
                        style={{fontSize: '0.85em', padding: '4px 8px', color: '#d32f2f'}}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          {selectedAssignment ? (
            <div>
              <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
                <h3 style={{margin: 0, fontSize: '20px', fontWeight: '600', color: '#333'}}>
                  📄 {selectedAssignment.title}
                </h3>
                <div style={{display: 'flex', gap: '10px'}}>
                  <button 
                    onClick={() => setViewMode('submissions')} 
                    className={viewMode === 'submissions' ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{fontSize: '14px'}}
                  >
                    📥 Submissions
                  </button>
                  <button 
                    onClick={() => {
                      setViewMode('students')
                      if(selectedAssignment) {
                        fetchAllStudents(selectedAssignment.id)
                      }
                    }} 
                    className={viewMode === 'students' ? 'btn btn-primary' : 'btn btn-secondary'}
                    style={{fontSize: '14px'}}
                  >
                    👥 All Students
                  </button>
                  <button onClick={() => {
                    if(viewMode === 'submissions') fetchSubmissions(selectedAssignment.id)
                    else fetchAllStudents(selectedAssignment.id)
                  }} className="btn btn-secondary" style={{fontSize: '14px'}}>
                    🔄 Refresh
                  </button>
                </div>
              </div>
              <div style={{maxHeight: '600px', overflowY: 'auto'}}>
                {viewMode === 'submissions' ? (
                  submissions.length === 0 ? (
                    <p>No submissions yet.</p>
                  ) : (
                    submissions.map(s => (
                      <div key={s.id} className="card" style={{marginBottom: '10px'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                          <div style={{flex: 1}}>
                            <h4 style={{margin: '0 0 10px 0', fontSize: '18px', fontWeight: '600', color: '#333'}}>
                              👤 {s.full_name || s.username}
                              {s.student_id && <span style={{color: '#667eea', fontSize: '0.85em', marginLeft: '10px', fontWeight: '500'}}>(ID: {s.student_id})</span>}
                            </h4>
                            <p style={{margin: '6px 0', fontSize: '0.95em', color: '#555'}}>
                              📄 File: <strong style={{color: '#667eea'}}>{extractOriginalFilename(s.filename)}</strong> 
                              <span style={{color: '#888', marginLeft: '8px'}}>({(s.file_size / 1024).toFixed(2)} KB)</span>
                            </p>
                            <p style={{margin: '6px 0', fontSize: '0.9em', color: '#888'}}>
                              ⏰ Submitted: {formatDeadline(s.submitted_at)}
                            </p>
                          </div>
                          <div style={{display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '12px'}}>
                            <button 
                              onClick={() => viewSubmission(s.id, extractOriginalFilename(s.filename))}
                              className="btn btn-view"
                              style={{minWidth: '100px'}}
                            >
                              👁️ View
                            </button>
                            <button 
                              onClick={() => downloadSubmission(s.id, extractOriginalFilename(s.filename))}
                              className="btn btn-primary"
                              style={{minWidth: '100px'}}
                            >
                              ⬇️ Download
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )
                ) : (
                  allStudents.length === 0 ? (
                    <p>No students found.</p>
                  ) : (
                    <div>
                      <table style={{width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)'}}>
                        <thead>
                          <tr style={{background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white'}}>
                            <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Roll No. / ID</th>
                            <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Name</th>
                            <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Username</th>
                            <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Status</th>
                            <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Submitted At</th>
                            <th style={{padding: '12px', textAlign: 'left', fontWeight: '600'}}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allStudents.map(s => (
                            <tr key={s.id} style={{borderBottom: '1px solid #e3e6ee', transition: 'background 0.2s'}} onMouseEnter={(e) => e.currentTarget.style.background = '#f6f7fb'} onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
                              <td style={{padding: '12px', fontWeight: '600', color: '#667eea'}}>{s.student_id || s.id}</td>
                              <td style={{padding: '12px'}}>{s.full_name || '-'}</td>
                              <td style={{padding: '12px', color: '#666'}}>{s.username}</td>
                              <td style={{padding: '12px'}}>
                                {s.submission_id ? (
                                  <span style={{color: '#28c76f', fontWeight: '600', fontSize: '0.9em'}}>✓ Submitted</span>
                                ) : (
                                  <span style={{color: '#d32f2f', fontWeight: '600', fontSize: '0.9em'}}>✗ Not Submitted</span>
                                )}
                              </td>
                              <td style={{padding: '12px', fontSize: '0.9em', color: '#666'}}>
                                {s.submitted_at ? formatDeadline(s.submitted_at) : '-'}
                              </td>
                              <td style={{padding: '10px'}}>
                                {s.submission_id ? (
                                  <div style={{display: 'flex', gap: '6px', flexDirection: 'column'}}>
                                    <button 
                                      onClick={async () => {
                                        try {
                                          const subsRes = await api.get(`/assignments/${selectedAssignment.id}/submissions`)
                                          if(subsRes.data.ok) {
                                            const submission = subsRes.data.submissions.find(sub => sub.user_id === s.id)
                                            if(submission) {
                                              viewSubmission(submission.id, extractOriginalFilename(submission.filename))
                                            } else {
                                              alert('Submission file not found')
                                            }
                                          }
                                        } catch(err) {
                                          alert('Failed to load: ' + (err.response?.data?.error || err.message))
                                        }
                                      }}
                                      className="btn btn-view"
                                      style={{fontSize: '0.85em', padding: '6px 12px', width: '100%'}}
                                    >
                                      👁️ View
                                    </button>
                                    <button 
                                      onClick={async () => {
                                        try {
                                          const subsRes = await api.get(`/assignments/${selectedAssignment.id}/submissions`)
                                          if(subsRes.data.ok) {
                                            const submission = subsRes.data.submissions.find(sub => sub.user_id === s.id)
                                            if(submission) {
                                              downloadSubmission(submission.id, extractOriginalFilename(submission.filename))
                                            } else {
                                              alert('Submission file not found')
                                            }
                                          }
                                        } catch(err) {
                                          alert('Failed to download: ' + (err.response?.data?.error || err.message))
                                        }
                                      }}
                                      className="btn btn-primary"
                                      style={{fontSize: '0.85em', padding: '6px 12px', width: '100%'}}
                                    >
                                      ⬇️ Download
                                    </button>
                                  </div>
                                ) : (
                                  <span style={{color: '#888', fontSize: '0.9em'}}>-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                )}
              </div>
            </div>
          ) : (
            <div className="card" style={{textAlign: 'center', padding: '40px', color: '#888'}}>
              <p>Select an assignment to view submissions</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

