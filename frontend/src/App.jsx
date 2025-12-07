import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import InterviewSetup from './pages/InterviewSetup';
import Interview from './pages/Interview';
import Result from './pages/Result';
import AudioTest from './pages/AudioTest';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-dark-900 text-white font-sans selection:bg-primary-500/30">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/interview/:sessionId" element={<InterviewSetup />} />
          <Route path="/interview-session/:sessionId" element={<Interview />} />
          <Route path="/result/:sessionId" element={<Result />} />
          <Route path="/audio-test" element={<AudioTest />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
