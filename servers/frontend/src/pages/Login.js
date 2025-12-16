import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/api/auth/login', {
        username,
        password
      });

      // Save tokens
      localStorage.setItem('access_token', response.data.access_token);
      localStorage.setItem('refresh_token', response.data.refresh_token);

      // If TOTP required, go to setup/verify
      if (response.data.requires_totp) {
        navigate('/totp-setup');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <div className="card" style={{ maxWidth: '450px', margin: '100px auto' }}>
        <h1 style={{ textAlign: 'center', marginBottom: '10px' }}>🔐 Zero-Trust VPN</h1>
        <p style={{ textAlign: 'center', marginBottom: '30px', color: '#718096' }}>
          Secure Access with Multi-Factor Authentication
        </p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Email
            </label>
            <input
              type="email"
              className="input"
              placeholder="john@company.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: '600' }}>
              Password
            </label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={{ marginTop: '30px', padding: '15px', background: '#f7fafc', borderRadius: '6px' }}>
          <p style={{ fontSize: '14px', marginBottom: '10px' }}><strong>Test Accounts:</strong></p>
          <p style={{ fontSize: '13px', margin: '5px 0' }}>👤 john@company.com / password123</p>
          <p style={{ fontSize: '13px', margin: '5px 0' }}>👤 alice@company.com / password123</p>
          <p style={{ fontSize: '13px', margin: '5px 0' }}>👤 bob@company.com / password123</p>
        </div>
      </div>
    </div>
  );
}

export default Login;
