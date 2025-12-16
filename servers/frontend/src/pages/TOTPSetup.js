import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function TOTPSetup() {
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setupTOTP();
  }, []);

  const setupTOTP = async () => {
    try {
      const response = await api.post('/api/auth/totp/setup');
      setQrCode(response.data.qr_code);
      setSecret(response.data.secret);
      setLoading(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to setup TOTP');
      setLoading(false);
    }
  };

  const handleContinue = () => {
    navigate('/totp-verify');
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '500px', margin: '100px auto' }}>
          <div className="loading">
            <div className="spinner"></div>
            <p style={{ marginTop: '20px' }}>Setting up TOTP...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '500px', margin: '100px auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>📱 Setup TOTP</h1>
        <p style={{ textAlign: 'center', marginBottom: '30px', color: '#718096' }}>
          Step 2 of 3: Configure Multi-Factor Authentication
        </p>

        {error && <div className="error">{error}</div>}

        <div style={{ textAlign: 'center' }}>
          <p style={{ marginBottom: '20px', fontWeight: '600' }}>
            Scan this QR code with your authenticator app:
          </p>
          
          {qrCode && (
            <img 
              src={qrCode} 
              alt="QR Code" 
              style={{ 
                maxWidth: '250px', 
                margin: '0 auto 20px',
                border: '2px solid #e2e8f0',
                borderRadius: '8px',
                padding: '10px'
              }} 
            />
          )}

          <div style={{ 
            background: '#f7fafc', 
            padding: '15px', 
            borderRadius: '6px',
            marginBottom: '20px'
          }}>
            <p style={{ fontSize: '14px', marginBottom: '10px' }}>
              <strong>Recommended Apps:</strong>
            </p>
            <p style={{ fontSize: '13px', margin: '5px 0' }}>
              • Google Authenticator (iOS/Android)
            </p>
            <p style={{ fontSize: '13px', margin: '5px 0' }}>
              • Microsoft Authenticator
            </p>
            <p style={{ fontSize: '13px', margin: '5px 0' }}>
              • Authy
            </p>
          </div>

          <details style={{ 
            background: '#fff5f5', 
            padding: '15px', 
            borderRadius: '6px',
            marginBottom: '20px',
            textAlign: 'left'
          }}>
            <summary style={{ cursor: 'pointer', fontWeight: '600', color: '#c53030' }}>
              Can't scan? Enter manually
            </summary>
            <div style={{ marginTop: '10px' }}>
              <p style={{ fontSize: '13px', marginBottom: '5px' }}>
                <strong>Account:</strong> Your email
              </p>
              <p style={{ fontSize: '13px', marginBottom: '5px' }}>
                <strong>Key:</strong>
              </p>
              <code style={{ 
                background: '#2d3748', 
                color: '#48bb78', 
                padding: '10px',
                display: 'block',
                borderRadius: '4px',
                fontSize: '12px',
                wordBreak: 'break-all'
              }}>
                {secret}
              </code>
            </div>
          </details>

          <button
            onClick={handleContinue}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            I've Scanned the QR Code →
          </button>
        </div>
      </div>
    </div>
  );
}

export default TOTPSetup;
