import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function Dashboard() {
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [wgConfig, setWgConfig] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadReady, setDownloadReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load profile
      const profileRes = await api.get('/api/user/profile');
      setProfile(profileRes.data);

      // Load permissions
      const permissionsRes = await api.get('/api/user/permissions');
      setPermissions(permissionsRes.data);

      setLoading(false);
    } catch (err) {
      setError('Failed to load user data');
      setLoading(false);
    }
  };

  const handleGetWireGuardConfig = async () => {
    try {
      setError('');
      const mfaToken = localStorage.getItem('mfa_token');
      
      if (!mfaToken) {
        setError('MFA token missing. Please login again.');
        return;
      }

      const response = await api.post('/api/wireguard/config', {
        mfa_token: mfaToken
      });

      setWgConfig(response.data.config);
      setDownloadReady(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get WireGuard config');
    }
  };

  const handleDownloadConfig = () => {
    const element = document.createElement('a');
    const file = new Blob([wgConfig], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = 'company-vpn.conf';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '800px', margin: '50px auto' }}>
          <div className="loading">
            <div className="spinner"></div>
            <p style={{ marginTop: '20px' }}>Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div style={{ maxWidth: '900px', margin: '50px auto' }}>
        {/* Header */}
        <div className="card" style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1>Welcome, {profile?.name || profile?.username}! 👋</h1>
              <p style={{ color: '#718096', marginTop: '5px' }}>
                ✉️ {profile?.email}
                {profile?.email_verified && (
                  <span className="badge badge-success" style={{ marginLeft: '10px' }}>
                    Verified
                  </span>
                )}
              </p>
            </div>
            <button onClick={handleLogout} className="btn btn-secondary">
              Logout
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {/* WireGuard Config */}
        <div className="card">
          <h2>🔐 WireGuard VPN Configuration</h2>
          
          {!downloadReady ? (
            <div>
              <p style={{ marginBottom: '20px' }}>
                Click the button below to generate your personalized WireGuard configuration.
                This config includes your unique encryption keys and is valid for 8 hours.
              </p>
              <button 
                onClick={handleGetWireGuardConfig}
                className="btn btn-primary"
              >
                🔑 Generate WireGuard Config
              </button>
            </div>
          ) : (
            <div>
              <div className="success">
                ✅ Configuration generated successfully!
              </div>
              
              <div className="code-block" style={{ maxHeight: '300px', overflow: 'auto' }}>
                <pre>{wgConfig}</pre>
              </div>

              <button 
                onClick={handleDownloadConfig}
                className="btn btn-primary"
                style={{ marginTop: '15px' }}
              >
                📥 Download Config File
              </button>

              <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                background: '#edf2f7', 
                borderRadius: '6px' 
              }}>
                <p style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px' }}>
                  🚀 How to connect:
                </p>
                <ol style={{ fontSize: '13px', paddingLeft: '20px' }}>
                  <li>Download and install WireGuard client</li>
                  <li>Import the downloaded config file</li>
                  <li>Click "Activate" to connect</li>
                  <li>Test connection: <code>ping 10.0.0.1</code></li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Permissions */}
        {permissions && (
          <div className="card">
            <h2>🔒 Your Permissions</h2>
            
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>📊 Databases</h3>
              {permissions.databases.length > 0 ? (
                <div>
                  {permissions.databases.map((db, idx) => (
                    <span key={idx} className="badge badge-success">
                      {db}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '14px', color: '#718096' }}>No database access</p>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>🖥️ Servers</h3>
              {permissions.servers.length > 0 ? (
                <div>
                  {permissions.servers.map((server, idx) => (
                    <span key={idx} className="badge badge-success">
                      {server}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '14px', color: '#718096' }}>No server access</p>
              )}
            </div>

            <div>
              <h3 style={{ fontSize: '16px', marginBottom: '10px' }}>🔌 APIs</h3>
              {permissions.apis.length > 0 ? (
                <div>
                  {permissions.apis.map((api, idx) => (
                    <span key={idx} className="badge badge-success">
                      {api}
                    </span>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '14px', color: '#718096' }}>No API access</p>
              )}
            </div>
          </div>
        )}

        {/* Security Info */}
        <div className="card" style={{ background: '#f7fafc' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>🔐 Security Features Active</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            <div style={{ fontSize: '13px' }}>✅ Multi-Factor Authentication</div>
            <div style={{ fontSize: '13px' }}>✅ End-to-End Encryption</div>
            <div style={{ fontSize: '13px' }}>✅ Least Privilege Access</div>
            <div style={{ fontSize: '13px' }}>✅ Audit Logging Enabled</div>
            <div style={{ fontSize: '13px' }}>✅ Token Expiration (8h)</div>
            <div style={{ fontSize: '13px' }}>✅ Device Verification</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
