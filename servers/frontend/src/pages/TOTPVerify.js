import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function TOTPVerify() {
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [setupCompleted, setSetupCompleted] = useState(false);
  const [isFirstTime, setIsFirstTime] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkTOTPStatus();
  }, []);

  const checkTOTPStatus = async () => {
    try {
      const response = await api.get('/auth/totp/status');
      setSetupCompleted(response.data.setup_completed);
      setIsFirstTime(!response.data.setup_completed && response.data.has_secret);
    } catch (err) {
      console.error('Failed to check TOTP status:', err);
      setSetupCompleted(true);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/totp/verify', {
        totp_code: totpCode
      });

      // Save MFA token
      localStorage.setItem('mfa_token', response.data.mfa_token);

      // Redirect to dashboard
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid TOTP code. Please try again.');
      setTotpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setTotpCode(value);
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '450px', margin: '100px auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>🔢 Verify TOTP</h1>
        <p style={{ textAlign: 'center', marginBottom: '30px', color: '#718096' }}>
          Step 3 of 3: Enter the 6-digit code from your authenticator app
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ textAlign: 'center' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '15px', 
              fontWeight: '600',
              fontSize: '18px'
            }}>
              📱 6-Digit Code
            </label>
            <input
              type="text"
              className="input"
              placeholder="000000"
              value={totpCode}
              onChange={handleCodeChange}
              required
              disabled={loading}
              maxLength="6"
              style={{ 
                fontSize: '28px', 
                letterSpacing: '10px',
                textAlign: 'center',
                fontWeight: '600'
              }}
              autoFocus
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '20px' }}
            disabled={loading || totpCode.length !== 6}
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        <div style={{ 
          marginTop: '30px', 
          padding: '15px', 
          background: '#edf2f7', 
          borderRadius: '6px',
          textAlign: 'center'
        }}>
          <p style={{ fontSize: '13px', color: '#4a5568', margin: 0 }}>
            ⏱ Code refreshes every 30 seconds
          </p>
          <p style={{ fontSize: '13px', color: '#4a5568', marginTop: '5px', marginBottom: 0 }}>
            Open your authenticator app to get the current code
          </p>
        </div>

        {isFirstTime && (
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            background: '#fff5f5', 
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '13px', color: '#c53030', margin: 0 }}>
              🔒 First time login: Verify code after scanning QR
            </p>
          </div>
        )}

        {setupCompleted && (
          <div style={{ 
            marginTop: '15px', 
            padding: '12px', 
            background: '#f0fff4', 
            borderRadius: '6px',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '13px', color: '#22543d', margin: 0 }}>
              ✅ TOTP configured. Enter code to access dashboard.
            </p>
          </div>
        )}

        <div style={{
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #e2e8f0',
          textAlign: 'center'
        }}>
          <button
            onClick={handleLogout}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#718096',
              cursor: 'pointer',
              fontSize: '14px',
              textDecoration: 'underline'
            }}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default TOTPVerify;
