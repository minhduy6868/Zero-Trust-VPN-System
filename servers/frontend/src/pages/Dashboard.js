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
  const [vpnConnected, setVpnConnected] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const profileRes = await api.get('/api/user/profile');
      setProfile(profileRes.data);

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
    element.download = `${profile?.username || 'user'}-wireguard.conf`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const getRoleBadgeColor = (level) => {
    switch(level) {
      case 'limited': return '#f56565';
      case 'medium': return '#ed8936';
      case 'full': return '#48bb78';
      default: return '#718096';
    }
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
      <div style={{ maxWidth: '1100px', margin: '50px auto' }}>
        {/* Header with User Info */}
        <div className="card" style={{ 
          marginBottom: '20px', 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ color: 'white', marginBottom: '5px' }}>
                👋 Welcome back, {profile?.name}!
              </h1>
              <p style={{ opacity: 0.9, marginBottom: '5px' }}>
                ✉️ {profile?.email}
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <span style={{ 
                  background: 'rgba(255,255,255,0.2)', 
                  padding: '5px 12px', 
                  borderRadius: '15px', 
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  {profile?.role_display}
                </span>
                <span style={{ 
                  background: getRoleBadgeColor(profile?.level), 
                  padding: '5px 12px', 
                  borderRadius: '15px', 
                  fontSize: '13px',
                  fontWeight: '600'
                }}>
                  {profile?.level?.toUpperCase()} ACCESS
                </span>
              </div>
            </div>
            <button 
              onClick={handleLogout} 
              style={{
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '10px 20px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
            >
              🚪 Logout
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
          {/* Left Column */}
          <div>
            {/* VPN Connection */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px' }}>
                <div style={{ 
                  width: '50px', 
                  height: '50px', 
                  background: '#667eea', 
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  marginRight: '15px'
                }}>
                  🔐
                </div>
                <div>
                  <h2 style={{ marginBottom: '5px' }}>VPN CONNECTION</h2>
                  <p style={{ fontSize: '14px', color: '#718096', margin: 0 }}>
                    {vpnConnected ? '🟢 Connected' : '⚫ Not Connected'}
                  </p>
                </div>
              </div>
              
              {!downloadReady ? (
                <div>
                  <p style={{ marginBottom: '15px', fontSize: '14px' }}>
                    Generate your encrypted WireGuard configuration to establish a secure VPN tunnel.
                  </p>
                  <button 
                    onClick={handleGetWireGuardConfig}
                    className="btn btn-primary"
                    style={{ width: '100%' }}
                  >
                    📥 GENERATE WIREGUARD CONFIG
                  </button>
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    background: '#edf2f7',
                    borderRadius: '8px',
                    fontSize: '13px'
                  }}>
                    <strong>ℹ️ Info:</strong> VPN Type: {permissions?.vpn_access}
                    <br/>
                    Assigned IP Range: 10.0.0.x
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{
                    padding: '15px',
                    background: '#c6f6d5',
                    border: '1px solid #9ae6b4',
                    borderRadius: '8px',
                    marginBottom: '15px'
                  }}>
                    <strong>✅ Configuration Generated Successfully!</strong>
                    <p style={{ fontSize: '13px', margin: '5px 0 0 0' }}>
                      📄 File size: 342 bytes | 🔐 Encryption: ChaCha20
                    </p>
                  </div>
                  
                  <button 
                    onClick={handleDownloadConfig}
                    className="btn btn-primary"
                    style={{ width: '100%', marginBottom: '15px' }}
                  >
                    💾 DOWNLOAD CONFIG FILE
                  </button>

                  <details style={{ fontSize: '14px' }}>
                    <summary style={{ cursor: 'pointer', fontWeight: '600', marginBottom: '10px' }}>
                      📋 View Configuration
                    </summary>
                    <div className="code-block" style={{ maxHeight: '200px', overflow: 'auto' }}>
                      <pre style={{ fontSize: '12px' }}>{wgConfig}</pre>
                    </div>
                  </details>
                </div>
              )}
            </div>

            {/* Permissions Detail */}
            <div className="card">
              <h2 style={{ marginBottom: '20px' }}>
                🔒 YOUR PERMISSIONS ({permissions?.role_display})
              </h2>
              <p style={{ fontSize: '14px', color: '#718096', marginBottom: '20px' }}>
                {permissions?.description}
              </p>

              {/* Databases */}
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ 
                  fontSize: '15px', 
                  fontWeight: '600', 
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🗄️ Database Access
                </h3>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {permissions?.databases.map((db, idx) => (
                    <div key={idx} style={{
                      padding: '12px',
                      border: db.status === 'allowed' ? '1px solid #9ae6b4' : '1px solid #fc8181',
                      borderRadius: '8px',
                      background: db.status === 'allowed' ? '#f0fff4' : '#fff5f5',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <strong style={{ fontSize: '14px' }}>{db.name}</strong>
                        <p style={{ fontSize: '12px', color: '#718096', margin: '3px 0 0 0' }}>
                          {db.description}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {db.status === 'allowed' ? (
                          <>
                            <span style={{
                              background: '#48bb78',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: '600',
                              display: 'inline-block',
                              marginBottom: '4px'
                            }}>
                              {db.access}
                            </span>
                            <div style={{ fontSize: '20px' }}>✅</div>
                          </>
                        ) : (
                          <div style={{ fontSize: '20px' }}>⛔</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Servers */}
              <div style={{ marginBottom: '25px' }}>
                <h3 style={{ 
                  fontSize: '15px', 
                  fontWeight: '600', 
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  🖥️ Server Access
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {permissions?.servers.map((server, idx) => (
                    <div key={idx} style={{
                      padding: '12px',
                      border: server.status === 'allowed' ? '1px solid #9ae6b4' : '1px solid #fc8181',
                      borderRadius: '8px',
                      background: server.status === 'allowed' ? '#f0fff4' : '#fff5f5'
                    }}>
                      <div style={{ fontSize: '18px', marginBottom: '5px' }}>
                        {server.status === 'allowed' ? '✅' : '⛔'}
                      </div>
                      <strong style={{ fontSize: '13px', display: 'block' }}>{server.name}</strong>
                      <p style={{ fontSize: '11px', color: '#718096', margin: '3px 0 0 0' }}>
                        {server.ip || server.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Features & Stats */}
          <div>
            {/* Features */}
            <div className="card" style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>⚡ FEATURES</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(permissions?.features || {}).map(([key, value]) => (
                  <div key={key} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px',
                    background: '#f7fafc',
                    borderRadius: '6px',
                    fontSize: '13px'
                  }}>
                    <span style={{ fontWeight: '500' }}>
                      {key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </span>
                    <span style={{ fontSize: '16px' }}>
                      {value ? '✅' : '❌'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Status */}
            <div className="card" style={{ background: '#f7fafc' }}>
              <h3 style={{ fontSize: '16px', marginBottom: '15px' }}>🛡️ SECURITY STATUS</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>🔐 MFA Enabled</span>
                  <strong style={{ color: '#48bb78' }}>✓</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>🔒 Encryption</span>
                  <strong>ChaCha20</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>⏱️ Session Timeout</span>
                  <strong>8 hours</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>📊 Audit Logging</span>
                  <strong style={{ color: '#48bb78' }}>Active</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span>🌐 IP Range</span>
                  <strong>10.0.0.0/8</strong>
                </div>
              </div>
            </div>

            {/* Admin Actions (if admin) */}
            {permissions?.features?.admin_panel && (
              <div className="card" style={{ marginTop: '20px', background: '#fff5f5' }}>
                <h3 style={{ fontSize: '16px', marginBottom: '15px', color: '#c53030' }}>
                  ⚙️ ADMIN ACTIONS
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button className="btn btn-secondary" style={{ width: '100%', fontSize: '13px' }}>
                    👥 Manage Users
                  </button>
                  <button className="btn btn-secondary" style={{ width: '100%', fontSize: '13px' }}>
                    📋 View Logs
                  </button>
                  <button className="btn btn-secondary" style={{ width: '100%', fontSize: '13px' }}>
                    🔐 Edit Policies
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
