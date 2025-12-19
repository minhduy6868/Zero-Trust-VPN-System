import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import TOTPSetup from './pages/TOTPSetup';
import TOTPVerify from './pages/TOTPVerify';
import NewDashboard from './pages/NewDashboard';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/totp-setup" element={<TOTPSetup />} />
        <Route path="/totp-verify" element={<TOTPVerify />} />
        <Route path="/dashboard" element={<NewDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;
