import React, {useEffect, useState} from 'react'
import api from '../utils/api'

export default function StudentTab(){
  const [assignments, setAssignments] = useState([])
  const [selectedAssignment, setSelectedAssignment] = useState(null)
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetchAssignments()
  }, [])

  async function fetchAssignments(){
    try{
      const res = await api.get('/assignments')
      if(res.data.ok) setAssignments(res.data.assignments)
    }catch(err){
      console.error('Failed to fetch assignments:', err)
      alert('Failed to load assignments. Please make sure you are logged in.')
    }
  }

  async function handleSubmit(e){
    e.preventDefault()
    if(!selectedAssignment || !file){
      alert('Please select an assignment and a file')
      return
    }

    const token = localStorage.getItem('token')
    if(!token){
      alert('Please login first to submit assignments')
      return
    }

    const now = new Date()
    const deadline = new Date(selectedAssignment.deadline)
    if(now > deadline){
      alert('Deadline has passed. You cannot submit this assignment.')
      return
    }

    setUploading(true)
    try{
      const formData = new FormData()
      formData.append('file', file)
      formData.append('assignment_id', selectedAssignment.id)
      
      const res = await api.post('/submissions', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        }
      })
      
      if(res.data.ok){
        alert('Assignment submitted successfully!')
        setFile(null)
        // Reset file input
        const fileInput = document.querySelector('input[type="file"]')
        if(fileInput) fileInput.value = ''
        fetchAssignments()
      }else{
        alert('Submission failed: ' + (res.data.error || 'Unknown error'))
      }
    }catch(err){
      const errorMsg = err.response?.data?.error || err.message
      if(errorMsg.includes('Deadline')){
        alert('Submission failed: Deadline has passed')
      }else{
        alert('Submission failed: ' + errorMsg)
      }
    }finally{
      setUploading(false)
    }
  }

  const now = new Date()
  const formatDeadline = (deadline) => {
    const d = new Date(deadline)
    return d.toLocaleString()
  }

  const isPastDeadline = (deadline) => {
    return new Date(deadline) < now
  }

  const getTimeRemaining = (deadline) => {
    const diff = new Date(deadline) - now
    if(diff <= 0) return 'Deadline passed'
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    if(days > 0) return `${days}d ${hours}h remaining`
    if(hours > 0) return `${hours}h ${minutes}m remaining`
    return `${minutes}m remaining`
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
    <div className="student-tab">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', background: 'rgba(255,255,255,0.95)', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}>
        <h2 style={{margin: 0, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontSize: '28px', fontWeight: '700'}}>
          🎓 Student Portal
        </h2>
      </div>
      
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '0'}}>
        <div>
          <h3>Available Assignments ({assignments.length})</h3>
          <div style={{maxHeight: '600px', overflowY: 'auto'}}>
            {assignments.length === 0 ? (
              <p>No assignments available.</p>
            ) : (
              assignments.map(a => (
                <div 
                  key={a.id} 
                  className="card" 
                  style={{
                    marginBottom: '10px',
                    cursor: 'pointer',
                    border: selectedAssignment?.id === a.id ? '3px solid #667eea' : '2px solid rgba(255,255,255,0.3)',
                    backgroundColor: selectedAssignment?.id === a.id ? 'rgba(102,126,234,0.1)' : 'rgba(255,255,255,0.98)',
                    opacity: isPastDeadline(a.deadline) ? 0.7 : 1,
                    transition: 'all 0.3s'
                  }}
                  onClick={() => !isPastDeadline(a.deadline) && setSelectedAssignment(a)}
                >
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'start'}}>
                    <div style={{flex: 1}}>
                      <h4 style={{margin: '0 0 8px 0'}}>{a.title}</h4>
                      {a.description && (
                        <p style={{margin: '4px 0', fontSize: '0.9em', color: '#555'}}>
                          {a.description.substring(0, 150)}{a.description.length > 150 ? '...' : ''}
                        </p>
                      )}
                      <div style={{marginTop: '8px'}}>
                        <p style={{margin: '4px 0', fontSize: '0.9em', color: '#666'}}>
                          Deadline: <strong style={{color: isPastDeadline(a.deadline) ? '#d32f2f' : '#2f6fdb'}}>
                            {formatDeadline(a.deadline)}
                          </strong>
                        </p>
                        <p style={{margin: '4px 0', fontSize: '0.85em', color: isPastDeadline(a.deadline) ? '#d32f2f' : '#28c76f'}}>
                          {isPastDeadline(a.deadline) ? '⚠️ Deadline Passed' : `⏰ ${getTimeRemaining(a.deadline)}`}
                        </p>
                        {a.submission_id && (
                          <p style={{margin: '4px 0', fontSize: '0.85em', color: '#28c76f'}}>
                            ✓ Submitted: {extractOriginalFilename(a.submission_filename)} ({formatDeadline(a.submitted_at)})
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          {selectedAssignment ? (
            <div className="card">
              <h3>{selectedAssignment.title}</h3>
              
              {selectedAssignment.description && (
                <div style={{marginBottom: '15px', padding: '10px', backgroundColor: '#f6f7fb', borderRadius: '6px'}}>
                  <strong>Description:</strong>
                  <p style={{margin: '8px 0 0 0', whiteSpace: 'pre-wrap'}}>{selectedAssignment.description}</p>
                </div>
              )}

              <div style={{marginBottom: '15px', padding: '10px', backgroundColor: isPastDeadline(selectedAssignment.deadline) ? '#ffebee' : '#e8f5e9', borderRadius: '6px'}}>
                <p style={{margin: '0', fontSize: '0.9em'}}>
                  <strong>Deadline:</strong> {formatDeadline(selectedAssignment.deadline)}
                </p>
                <p style={{margin: '4px 0 0 0', fontSize: '0.85em', color: isPastDeadline(selectedAssignment.deadline) ? '#d32f2f' : '#28c76f'}}>
                  {isPastDeadline(selectedAssignment.deadline) ? '⚠️ Deadline has passed' : `⏰ ${getTimeRemaining(selectedAssignment.deadline)}`}
                </p>
              </div>

              {selectedAssignment.submission_id && (
                <div style={{marginBottom: '15px', padding: '10px', backgroundColor: '#e8f5e9', borderRadius: '6px'}}>
                  <p style={{margin: '0', fontSize: '0.9em', color: '#28c76f'}}>
                    ✓ You have already submitted: <strong>{extractOriginalFilename(selectedAssignment.submission_filename)}</strong>
                  </p>
                  <p style={{margin: '4px 0 0 0', fontSize: '0.85em', color: '#666'}}>
                    Submitted on: {formatDeadline(selectedAssignment.submitted_at)}
                  </p>
                  <p style={{margin: '8px 0 0 0', fontSize: '0.85em', color: '#666'}}>
                    You can upload a new file to replace your submission (before deadline).
                  </p>
                </div>
              )}

              {!isPastDeadline(selectedAssignment.deadline) ? (
                <form onSubmit={handleSubmit}>
                  <label>
                    <strong>Select File to Submit:</strong>
                  </label>
                  <input 
                    type="file" 
                    onChange={e => setFile(e.target.files[0])}
                    required
                    style={{marginBottom: '15px'}}
                  />
                  
                  {file && (
                    <div style={{marginBottom: '15px', padding: '10px', backgroundColor: '#f6f7fb', borderRadius: '6px'}}>
                      <p style={{margin: '0', fontSize: '0.9em'}}>
                        Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(2)} KB)
                      </p>
                    </div>
                  )}

                  <button 
                    type="submit" 
                    className="btn btn-primary"
                    disabled={uploading || !file}
                    style={{width: '100%'}}
                  >
                    {uploading ? 'Uploading...' : (selectedAssignment.submission_id ? 'Update Submission' : 'Submit Assignment')}
                  </button>
                </form>
              ) : (
                <div style={{padding: '15px', backgroundColor: '#ffebee', borderRadius: '6px', textAlign: 'center'}}>
                  <p style={{margin: '0', color: '#d32f2f'}}>
                    ⚠️ The deadline for this assignment has passed. You cannot submit or modify your submission.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{textAlign: 'center', padding: '40px', color: '#888'}}>
              <p>Select an assignment to view details and submit</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

