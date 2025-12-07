import React, { useState } from 'react'
import axios from 'axios'

export default function ResumeUploader({ apiUrl = 'http://localhost:8000/api/resumes/' }) {
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  const handleFile = (e) => {
    setFile(e.target.files[0])
    setStatus(null)
    setError(null)
  }

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose a file first')
      return
    }

    const formData = new FormData()
    formData.append('file', file)

    // If your frontend stores the JWT in localStorage
    const token = localStorage.getItem('access_token')

    try {
      setStatus('Uploading...')
      const res = await axios.post(apiUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      })

      setStatus('Upload complete')
      setError(null)
      console.log('Resume uploaded:', res.data)
    } catch (err) {
      setStatus(null)
      const msg = err.response?.data || err.message
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg))
      console.error('Upload error:', err)
    }
  }

  return (
    <div className="resume-uploader">
      <input type="file" accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFile} />
      <button onClick={handleUpload}>Upload Resume</button>
      {status && <div style={{ color: 'green' }}>{status}</div>}
      {error && <div style={{ color: 'red' }}>{error}</div>}
    </div>
  )
}
