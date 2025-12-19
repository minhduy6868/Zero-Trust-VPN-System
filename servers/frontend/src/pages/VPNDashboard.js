import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function VPNDashboard() {
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [wgConfig, setWgConfig] = useState('');
  const [activeTab, setActiveTab] = useState('vpn');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadReady, setDownloadReady] = useState(false);
  const [vpnStatus, setVpnStatus] = useState('disconnected');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const profileRes = await api.get('/user/profile');
      setProfile(profileRes.data);

      const permissionsRes = await api.get('/user/permissions');
      setPermissions(permissionsRes.data);

      setLoading(false);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Failed to load dashboard data');
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

      const response = await api.post('/wireguard/config', {
        mfa_token: mfaToken
      });

      setWgConfig(response.data.config);
      setDownloadReady(true);
      setVpnStatus('configured');
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
      <div style={styles.container}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner}></div>
          <p style={{ marginTop: '20px', color: '#667eea' }}>Loading Zero-Trust VPN System...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerContent}>
          <div>
            <h1 style={styles.title}>🔐 Zero-Trust VPN System</h1>
            <p style={styles.subtitle}>
              {profile?.name} • {permissions?.role?.display_name}
            </p>
          </div>
          <div style={styles.headerActions}>
            {permissions?.features?.user_management && (
              <button onClick={() => navigate('/admin')} style={styles.adminBtn}>
                👑 Admin Panel
              </button>
            )}
            <button onClick={handleLogout} style={styles.logoutBtn}>
              🚪 Logout
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={styles.tabContainer}>
        <button
          onClick={() => setActiveTab('vpn')}
          style={{...styles.tab, ...(activeTab === 'vpn' ? styles.activeTab : {})}}
        >
          🔐 VPN Connection
        </button>
        <button
          onClick={() => setActiveTab('permissions')}
          style={{...styles.tab, ...(activeTab === 'permissions' ? styles.activeTab : {})}}
        >
          🔒 My Permissions
        </button>
        <button
          onClick={() => setActiveTab('security')}
          style={{...styles.tab, ...(activeTab === 'security' ? styles.activeTab : {})}}
        >
          🛡️ Security Status
        </button>
      </div>

      <div style={styles.content}>
        {error && <div style={styles.errorBox}>{error}</div>}

        {/* VPN Tab */}
        {activeTab === 'vpn' && (
          <div>
            {/* VPN Status Card */}
            <div style={styles.vpnCard}>
              <div style={styles.vpnHeader}>
                <div style={styles.vpnIcon}>🔐</div>
                <div>
                  <h2 style={styles.vpnTitle}>WireGuard VPN Connection</h2>
                  <p style={styles.vpnSubtitle}>
                    Status: <span style={{
                      color: vpnStatus === 'connected' ? '#48bb78' : 
                             vpnStatus === 'configured' ? '#ed8936' : '#f56565',
                      fontWeight: 'bold'
                    }}>
                      {vpnStatus === 'connected' ? '🟢 Connected' : 
                       vpnStatus === 'configured' ? '🟡 Configured' : '⚫ Not Connected'}
                    </span>
                  </p>
                </div>
              </div>

              {!downloadReady ? (
                <div>
                  <div style={styles.infoBox}>
                    <h3 style={styles.infoTitle}>🔒 Zero-Trust VPN Protection</h3>
                    <p style={styles.infoText}>
                      This WireGuard configuration provides:
                    </p>
                    <ul style={styles.featureList}>
                      <li>✅ End-to-end ChaCha20 encryption</li>
                      <li>✅ MFA-verified secure tunnel</li>
                      <li>✅ Policy-based access control (via Vault)</li>
                      <li>✅ Real-time audit logging</li>
                      <li>✅ Assigned IP: 10.0.0.x/24</li>
                      <li>✅ Access Level: {permissions?.role?.vpn_access}</li>
                    </ul>
                  </div>

                  <button onClick={handleGetWireGuardConfig} style={styles.generateBtn}>
                    📥 GENERATE WIREGUARD CONFIG
                  </button>

                  <div style={styles.helpBox}>
                    <strong>ℹ️ What happens next?</strong>
                    <p style={{fontSize: '14px', marginTop: '8px', lineHeight: '1.6'}}>
                      1. Click button to generate your encrypted VPN config<br/>
                      2. Download the .conf file<br/>
                      3. Install WireGuard on your device<br/>
                      4. Import the config file<br/>
                      5. Connect to establish secure tunnel
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={styles.successBox}>
                    <strong>✅ Configuration Generated Successfully!</strong>
                    <p style={styles.successText}>
                      📄 Encrypted config ready | 🔐 ChaCha20 | ⏱️ Valid for 24 hours
                    </p>
                  </div>

                  <button onClick={handleDownloadConfig} style={styles.downloadBtn}>
                    💾 DOWNLOAD WIREGUARD CONFIG
                  </button>

                  <details style={styles.details}>
                    <summary style={styles.summary}>📋 View Configuration</summary>
                    <div style={styles.codeBlock}>
                      <pre style={styles.pre}>{wgConfig}</pre>
                    </div>
                  </details>

                  {/* Installation Instructions */}
                  <div style={styles.instructionsBox}>
                    <h3 style={styles.instructionsTitle}>📱 Installation Instructions</h3>
                    
                    <div style={styles.instructionSection}>
                      <h4 style={styles.osTitle}>🪟 Windows</h4>
                      <ol style={styles.instructionList}>
                        <li>Download WireGuard: <a href="https://www.wireguard.com/install/" target="_blank" rel="noopener noreferrer" style={styles.link}>wireguard.com/install</a></li>
                        <li>Install and open WireGuard</li>
                        <li>Click "Import tunnel(s) from file"</li>
                        <li>Select your downloaded .conf file</li>
                        <li>Click "Activate" to connect</li>
                      </ol>
                    </div>

                    <div style={styles.instructionSection}>
                      <h4 style={styles.osTitle}>🐧 Linux</h4>
                      <div style={styles.codeBlock}>
                        <pre style={styles.pre}>{`# Install WireGuard
sudo apt install wireguard

# Copy config
sudo cp ${profile?.username || 'user'}-wireguard.conf /etc/wireguard/wg0.conf

# Start VPN
sudo wg-quick up wg0

# Check status
sudo wg show

# Stop VPN
sudo wg-quick down wg0`}</pre>
                      </div>
                    </div>

                    <div style={styles.instructionSection}>
                      <h4 style={styles.osTitle}>🍎 macOS</h4>
                      <ol style={styles.instructionList}>
                        <li>Install via Homebrew: <code style={styles.code}>brew install wireguard-tools</code></li>
                        <li>Or download from App Store: "WireGuard"</li>
                        <li>Import your .conf file</li>
                        <li>Toggle connection ON</li>
                      </ol>
                    </div>

                    <div style={styles.instructionSection}>
                      <h4 style={styles.osTitle}>📱 Mobile (iOS/Android)</h4>
                      <ol style={styles.instructionList}>
                        <li>Install WireGuard app from App Store / Play Store</li>
                        <li>Tap "+" → "Create from file or archive"</li>
                        <li>Select your .conf file</li>
                        <li>Tap the toggle to connect</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Access Level Info */}
            <div style={styles.infoCard}>
              <h3 style={styles.cardTitle}>🎯 Your Access Level</h3>
              <div style={styles.accessInfo}>
                <div style={styles.accessItem}>
                  <span style={styles.accessLabel}>VPN Type:</span>
                  <span style={{...styles.accessBadge, backgroundColor: getRoleBadgeColor(permissions?.role?.level)}}>
                    {permissions?.role?.vpn_access?.toUpperCase()}
                  </span>
                </div>
                <div style={styles.accessItem}>
                  <span style={styles.accessLabel}>Access Level:</span>
                  <span style={styles.accessValue}>{permissions?.role?.level?.toUpperCase()}</span>
                </div>
                <div style={styles.accessItem}>
                  <span style={styles.accessLabel}>Encryption:</span>
                  <span style={styles.accessValue}>ChaCha20-Poly1305</span>
                </div>
                <div style={styles.accessItem}>
                  <span style={styles.accessLabel}>IP Range:</span>
                  <span style={styles.accessValue}>10.0.0.0/24</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Tab */}
        {activeTab === 'permissions' && (
          <div>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>🔒 Your Permissions ({permissions?.role?.display_name})</h2>
              <p style={styles.description}>{permissions?.role?.description}</p>

              {/* Databases */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>🗄️ Database Access</h3>
                <div style={styles.grid}>
                  {permissions?.databases?.map((db, idx) => (
                    <div key={idx} style={{
                      ...styles.permissionCard,
                      borderLeft: `4px solid ${db.status === 'allowed' ? '#48bb78' : '#f56565'}`
                    }}>
                      <div style={styles.permissionHeader}>
                        <strong>{db.name}</strong>
                        <span style={styles.permissionIcon}>
                          {db.status === 'allowed' ? '✅' : '⛔'}
                        </span>
                      </div>
                      <p style={styles.permissionDesc}>{db.description}</p>
                      {db.status === 'allowed' && (
                        <span style={styles.accessBadge}>{db.access}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Servers */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>🖥️ Server Access</h3>
                <div style={styles.grid}>
                  {permissions?.servers?.map((server, idx) => (
                    <div key={idx} style={{
                      ...styles.permissionCard,
                      borderLeft: `4px solid ${server.status === 'allowed' ? '#48bb78' : '#f56565'}`
                    }}>
                      <div style={styles.permissionHeader}>
                        <strong>{server.name}</strong>
                        <span style={styles.permissionIcon}>
                          {server.status === 'allowed' ? '✅' : '⛔'}
                        </span>
                      </div>
                      <p style={styles.permissionDesc}>{server.ip || server.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>⚡ Features & Capabilities</h3>
                <div style={styles.featureGrid}>
                  {Object.entries(permissions?.features || {}).map(([key, value]) => (
                    <div key={key} style={styles.featureItem}>
                      <span>{key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</span>
                      <span style={{fontSize: '20px'}}>{value ? '✅' : '❌'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>🛡️ Security Status</h2>
              
              <div style={styles.securityGrid}>
                <div style={styles.securityItem}>
                  <div style={styles.securityIcon}>🔐</div>
                  <div>
                    <div style={styles.securityLabel}>Multi-Factor Auth</div>
                    <div style={styles.securityValue}>✅ Enabled (TOTP)</div>
                  </div>
                </div>

                <div style={styles.securityItem}>
                  <div style={styles.securityIcon}>🔒</div>
                  <div>
                    <div style={styles.securityLabel}>Encryption</div>
                    <div style={styles.securityValue}>ChaCha20-Poly1305</div>
                  </div>
                </div>

                <div style={styles.securityItem}>
                  <div style={styles.securityIcon}>⏱️</div>
                  <div>
                    <div style={styles.securityLabel}>Session Timeout</div>
                    <div style={styles.securityValue}>8 hours</div>
                  </div>
                </div>

                <div style={styles.securityItem}>
                  <div style={styles.securityIcon}>📊</div>
                  <div>
                    <div style={styles.securityLabel}>Audit Logging</div>
                    <div style={styles.securityValue}>✅ Active</div>
                  </div>
                </div>

                <div style={styles.securityItem}>
                  <div style={styles.securityIcon}>🌐</div>
                  <div>
                    <div style={styles.securityLabel}>VPN Network</div>
                    <div style={styles.securityValue}>10.0.0.0/24</div>
                  </div>
                </div>

                <div style={styles.securityItem}>
                  <div style={styles.securityIcon}>🔑</div>
                  <div>
                    <div style={styles.securityLabel}>Key Exchange</div>
                    <div style={styles.securityValue}>Curve25519</div>
                  </div>
                </div>
              </div>

              {/* Zero-Trust Principles */}
              <div style={styles.principlesBox}>
                <h3 style={styles.principlesTitle}>🎯 Zero-Trust Security Layers</h3>
                <div style={styles.layersList}>
                  <div style={styles.layer}>
                    <span style={styles.layerNumber}>1</span>
                    <div>
                      <strong>Authentication</strong>
                      <p style={styles.layerDesc}>Username + Password via Keycloak OIDC</p>
                    </div>
                  </div>
                  <div style={styles.layer}>
                    <span style={styles.layerNumber}>2</span>
                    <div>
                      <strong>Multi-Factor Authentication</strong>
                      <p style={styles.layerDesc}>TOTP 6-digit code (Google Authenticator)</p>
                    </div>
                  </div>
                  <div style={styles.layer}>
                    <span style={styles.layerNumber}>3</span>
                    <div>
                      <strong>Authorization</strong>
                      <p style={styles.layerDesc}>Policy-based access via HashiCorp Vault</p>
                    </div>
                  </div>
                  <div style={styles.layer}>
                    <span style={styles.layerNumber}>4</span>
                    <div>
                      <strong>Encrypted Tunnel</strong>
                      <p style={styles.layerDesc}>WireGuard VPN with ChaCha20 encryption</p>
                    </div>
                  </div>
                  <div style={styles.layer}>
                    <span style={styles.layerNumber}>5</span>
                    <div>
                      <strong>Continuous Monitoring</strong>
                      <p style={styles.layerDesc}>Real-time audit logs & anomaly detection</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    paddingBottom: '40px'
  },
  loadingCard: {
    maxWidth: '400px',
    margin: '100px auto',
    padding: '40px',
    background: 'white',
    borderRadius: '16px',
    textAlign: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)'
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '5px solid #e2e8f0',
    borderTop: '5px solid #667eea',
    borderRadius: '50%',
    margin: '0 auto',
    animation: 'spin 1s linear infinite'
  },
  header: {
    background: 'rgba(255,255,255,0.1)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.2)',
    padding: '20px 0'
  },
  headerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '20px'
  },
  title: {
    margin: '0 0 8px 0',
    color: 'white',
    fontSize: '32px',
    fontWeight: 'bold'
  },
  subtitle: {
    margin: 0,
    color: 'rgba(255,255,255,0.9)',
    fontSize: '16px'
  },
  headerActions: {
    display: 'flex',
    gap: '10px'
  },
  adminBtn: {
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.2)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  logoutBtn: {
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.2)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  tabContainer: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '20px 20px 0',
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap'
  },
  tab: {
    padding: '12px 24px',
    background: 'rgba(255,255,255,0.1)',
    color: 'rgba(255,255,255,0.7)',
    border: 'none',
    borderRadius: '12px 12px 0 0',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'all 0.3s'
  },
  activeTab: {
    background: 'white',
    color: '#667eea',
    fontWeight: 'bold'
  },
  content: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '0 20px 20px'
  },
  errorBox: {
    background: '#fed7d7',
    color: '#c53030',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontWeight: '500'
  },
  vpnCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '30px',
    marginBottom: '20px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
  },
  vpnHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '30px'
  },
  vpnIcon: {
    fontSize: '48px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '16px',
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  vpnTitle: {
    margin: '0 0 8px 0',
    fontSize: '24px',
    color: '#2d3748'
  },
  vpnSubtitle: {
    margin: 0,
    fontSize: '16px',
    color: '#718096'
  },
  infoBox: {
    background: '#f7fafc',
    padding: '20px',
    borderRadius: '12px',
    marginBottom: '20px',
    border: '1px solid #e2e8f0'
  },
  infoTitle: {
    margin: '0 0 12px 0',
    color: '#2d3748',
    fontSize: '18px'
  },
  infoText: {
    margin: '0 0 12px 0',
    color: '#4a5568',
    fontSize: '14px'
  },
  featureList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'grid',
    gap: '8px'
  },
  generateBtn: {
    width: '100%',
    padding: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '20px',
    transition: 'transform 0.2s'
  },
  helpBox: {
    background: '#ebf8ff',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #bee3f8',
    fontSize: '14px',
    color: '#2c5282'
  },
  successBox: {
    background: '#c6f6d5',
    padding: '16px',
    borderRadius: '8px',
    border: '1px solid #9ae6b4',
    marginBottom: '20px'
  },
  successText: {
    margin: '8px 0 0 0',
    fontSize: '13px',
    color: '#22543d'
  },
  downloadBtn: {
    width: '100%',
    padding: '16px',
    background: '#48bb78',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '20px',
    transition: 'transform 0.2s'
  },
  details: {
    marginBottom: '20px',
    fontSize: '14px'
  },
  summary: {
    cursor: 'pointer',
    fontWeight: '600',
    padding: '12px',
    background: '#f7fafc',
    borderRadius: '8px',
    marginBottom: '10px'
  },
  codeBlock: {
    background: '#2d3748',
    padding: '16px',
    borderRadius: '8px',
    overflow: 'auto',
    maxHeight: '300px'
  },
  pre: {
    margin: 0,
    color: '#e2e8f0',
    fontSize: '13px',
    fontFamily: 'monospace',
    lineHeight: '1.5'
  },
  instructionsBox: {
    background: '#f7fafc',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  },
  instructionsTitle: {
    margin: '0 0 20px 0',
    color: '#2d3748',
    fontSize: '20px'
  },
  instructionSection: {
    marginBottom: '24px',
    paddingBottom: '24px',
    borderBottom: '1px solid #e2e8f0'
  },
  osTitle: {
    margin: '0 0 12px 0',
    color: '#4a5568',
    fontSize: '16px'
  },
  instructionList: {
    margin: '8px 0',
    paddingLeft: '24px',
    lineHeight: '1.8',
    color: '#4a5568'
  },
  link: {
    color: '#667eea',
    textDecoration: 'underline'
  },
  code: {
    background: '#e2e8f0',
    padding: '2px 6px',
    borderRadius: '4px',
    fontFamily: 'monospace',
    fontSize: '13px'
  },
  infoCard: {
    background: 'white',
    borderRadius: '16px',
    padding: '30px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
  },
  cardTitle: {
    margin: '0 0 20px 0',
    color: '#2d3748',
    fontSize: '20px'
  },
  accessInfo: {
    display: 'grid',
    gap: '16px'
  },
  accessItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#f7fafc',
    borderRadius: '8px'
  },
  accessLabel: {
    fontWeight: '500',
    color: '#4a5568'
  },
  accessValue: {
    fontWeight: 'bold',
    color: '#2d3748'
  },
  accessBadge: {
    padding: '6px 12px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '12px',
    fontWeight: 'bold'
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '30px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
  },
  description: {
    color: '#718096',
    marginBottom: '30px',
    fontSize: '14px'
  },
  section: {
    marginBottom: '40px'
  },
  sectionTitle: {
    margin: '0 0 16px 0',
    color: '#2d3748',
    fontSize: '18px'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '16px'
  },
  permissionCard: {
    padding: '16px',
    background: '#f7fafc',
    borderRadius: '8px'
  },
  permissionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  permissionIcon: {
    fontSize: '20px'
  },
  permissionDesc: {
    margin: '8px 0',
    fontSize: '13px',
    color: '#718096'
  },
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '12px'
  },
  featureItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#f7fafc',
    borderRadius: '8px',
    fontSize: '14px'
  },
  securityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  securityItem: {
    display: 'flex',
    gap: '16px',
    padding: '20px',
    background: '#f7fafc',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  },
  securityIcon: {
    fontSize: '32px'
  },
  securityLabel: {
    fontSize: '13px',
    color: '#718096',
    marginBottom: '4px'
  },
  securityValue: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#2d3748'
  },
  principlesBox: {
    background: 'linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%)',
    padding: '24px',
    borderRadius: '12px',
    border: '1px solid #e2e8f0'
  },
  principlesTitle: {
    margin: '0 0 20px 0',
    color: '#2d3748',
    fontSize: '18px'
  },
  layersList: {
    display: 'grid',
    gap: '16px'
  },
  layer: {
    display: 'flex',
    gap: '16px',
    padding: '16px',
    background: 'white',
    borderRadius: '8px',
    alignItems: 'start'
  },
  layerNumber: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    flexShrink: 0
  },
  layerDesc: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    color: '#718096'
  }
};

export default VPNDashboard;
