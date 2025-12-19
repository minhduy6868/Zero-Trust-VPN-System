import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AdminPanel from './AdminPanel';

function NewDashboard() {
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [companyData, setCompanyData] = useState(null);
  const [vpnConfig, setVpnConfig] = useState(null);
  const [vpnLoading, setVpnLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Edit states
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const profileRes = await api.get('/user/profile');
      setProfile(profileRes.data);

      const permissionsRes = await api.get('/user/permissions');
      setPermissions(permissionsRes.data);

      const companyDataRes = await api.get('/company/data');
      setCompanyData(companyDataRes.data);

      setLoading(false);
    } catch (err) {
      console.error('Dashboard load error:', err);
      setError('Failed to load dashboard data');
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleEdit = (item, type) => {
    setEditingItem({ ...item, type });
    setEditForm({ ...item });
  };

  const handleDelete = async (id, type) => {
    if (!window.confirm(`Are you sure you want to delete this ${type}?`)) return;
    
    try {
      await api.delete(`/api/company/${type}/${id}`);
      loadData();
    } catch (err) {
      setError(`Failed to delete ${type}`);
    }
  };

  const handleSaveEdit = async () => {
    try {
      await api.put(`/api/company/${editingItem.type}/${editForm.id}`, editForm);
      setEditingItem(null);
      setEditForm({});
      loadData();
    } catch (err) {
      setError('Failed to save changes');
    }
  };

  const handleCreateRequest = async (type) => {
    const newRequest = {
      employee_email: profile.email,
      type: type,
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date().toISOString().split('T')[0],
      days: 1,
      reason: '',
      status: 'pending',
      submitted_date: new Date().toISOString().split('T')[0]
    };
    
    try {
      await api.post('/company/leave_requests', newRequest);
      loadData();
      setActiveTab('requests');
    } catch (err) {
      setError('Failed to create request');
    }
  };

  const canEdit = (item) => {
    if (permissions?.role?.level === 'full') return true;
    if (permissions?.role?.level === 'medium' && permissions?.features?.approve_requests) return true;
    if (item.employee_email === profile?.email) return true;
    return false;
  };

  const canDelete = () => {
    return permissions?.role?.level === 'full' || permissions?.features?.approve_requests;
  };

  const downloadVPNConfig = async () => {
    try {
      setVpnLoading(true);
      setError('');
      const response = await api.get('/vpn/config', { responseType: 'blob' });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `zerotrust-vpn-${profile?.name?.replace(/\s+/g, '-')}.conf`);
      document.body.appendChild(link);
      link.click();
      link.parentChild?.removeChild(link);
      
      setVpnConfig(response.data);
    } catch (err) {
      console.error('VPN download error:', err);
      setError('Failed to generate VPN config. Make sure you have completed TOTP verification.');
    } finally {
      setVpnLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '800px', margin: '50px auto', textAlign: 'center', padding: '40px' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '20px' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: '#f7fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ 
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '20px 0',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
      }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ margin: '0 0 10px 0', fontSize: '28px' }}>Welcome, {profile?.name}!</h1>
              <p style={{ margin: 0, opacity: 0.9 }}>
                {profile?.position} • {profile?.department}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{
                background: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                {permissions?.role?.display_name}
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', gap: '5px', overflowX: 'auto' }}>
            {['overview', 'vpn', 'company'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '15px 25px',
                  border: 'none',
                  background: activeTab === tab ? '#667eea' : 'transparent',
                  color: activeTab === tab ? 'white' : '#4a5568',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activeTab === tab ? 'bold' : 'normal',
                  borderBottom: activeTab === tab ? '3px solid #667eea' : '3px solid transparent',
                  transition: 'all 0.3s'
                }}
              >
                {tab === 'overview' && '📊 Overview'}
                {tab === 'vpn' && '🔐 VPN Config'}
                {tab === 'company' && '🏢 Company'}
              </button>
            ))}
            {permissions?.features?.user_management && (
              <button
                onClick={() => setActiveTab('admin')}
                style={{
                  padding: '15px 25px',
                  border: 'none',
                  background: activeTab === 'admin' ? '#e53e3e' : 'transparent',
                  color: activeTab === 'admin' ? 'white' : '#e53e3e',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: activeTab === 'admin' ? 'bold' : 'normal',
                  borderBottom: activeTab === 'admin' ? '3px solid #e53e3e' : '3px solid transparent',
                  transition: 'all 0.3s'
                }}
              >
                👑 Admin Panel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="container" style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
        {error && (
          <div style={{ 
            background: '#fed7d7', 
            color: '#c53030', 
            padding: '15px', 
            borderRadius: '8px', 
            marginBottom: '20px' 
          }}>
            {error}
          </div>
        )}

        {/* Overview Tab - User Profile & Permissions */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              {/* User Profile Card */}
              <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>👤 User Profile</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <p style={{ margin: '0 0 5px 0', opacity: 0.9, fontSize: '12px' }}>NAME</p>
                    <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{profile?.name}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', opacity: 0.9, fontSize: '12px' }}>EMAIL</p>
                    <p style={{ margin: 0, fontSize: '14px' }}>{profile?.email}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', opacity: 0.9, fontSize: '12px' }}>DEPARTMENT</p>
                    <p style={{ margin: 0, fontSize: '14px' }}>{profile?.department}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', opacity: 0.9, fontSize: '12px' }}>ROLE</p>
                    <p style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>{permissions?.role?.display_name}</p>
                  </div>
                </div>
              </div>

              {/* User Permissions Card */}
              <div className="card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>🔑 User Permissions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>{permissions?.vpn_enabled ? '✅' : '❌'}</span>
                    <span>VPN Enabled: <strong>{permissions?.vpn_enabled ? 'YES' : 'NO'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>{permissions?.company_access ? '✅' : '❌'}</span>
                    <span>Company Access: <strong>{permissions?.company_access ? 'YES' : 'NO'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>{permissions?.totp_enabled ? '🔐' : '⚠️'}</span>
                    <span>MFA (TOTP): <strong>{permissions?.totp_enabled ? 'ENABLED' : 'NOT ENABLED'}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span>🌐</span>
                    <span>VPN IP: <strong>{permissions?.vpn_ip || 'Not assigned'}</strong></span>
                  </div>
                </div>
              </div>

              {/* Company Data Card */}
              <div className="card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                <h3 style={{ margin: '0 0 15px 0' }}>🏢 Company Info</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div>
                    <p style={{ margin: '0 0 5px 0', opacity: 0.9, fontSize: '12px' }}>COMPANY</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{companyData?.company?.name}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', opacity: 0.9, fontSize: '12px' }}>DEPARTMENT</p>
                    <p style={{ margin: 0, fontSize: '14px' }}>{companyData?.company?.department}</p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', opacity: 0.9, fontSize: '12px' }}>EMPLOYEES</p>
                    <p style={{ margin: 0, fontSize: '16px', fontWeight: 'bold' }}>{companyData?.company?.employees}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Authentication Status */}
            <div className="card">
              <h2 style={{ marginTop: 0 }}>✓ Authentication Status</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div style={{ padding: '15px', background: '#c6f6d5', borderRadius: '8px', borderLeft: '4px solid #48bb78' }}>
                  <div style={{ fontWeight: 'bold', color: '#22543d', marginBottom: '5px' }}>✅ Username/Password</div>
                  <div style={{ color: '#22543d', fontSize: '14px' }}>Authentication successful</div>
                </div>
                <div style={{ padding: '15px', background: '#c6f6d5', borderRadius: '8px', borderLeft: '4px solid #48bb78' }}>
                  <div style={{ fontWeight: 'bold', color: '#22543d', marginBottom: '5px' }}>✅ TOTP MFA Code</div>
                  <div style={{ color: '#22543d', fontSize: '14px' }}>Multi-factor authentication verified</div>
                </div>
                <div style={{ padding: '15px', background: '#c6f6d5', borderRadius: '8px', borderLeft: '4px solid #48bb78' }}>
                  <div style={{ fontWeight: 'bold', color: '#22543d', marginBottom: '5px' }}>✅ User Permissions</div>
                  <div style={{ color: '#22543d', fontSize: '14px' }}>Role and permissions assigned</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VPN Config Tab */}
        {activeTab === 'vpn' && (
          <div>
            {/* VPN Status Card */}
            <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0 }}>🔐 VPN Configuration</h2>
              <p style={{ margin: '0 0 15px 0', opacity: 0.9 }}>
                Download your WireGuard VPN configuration file. This file contains your unique credentials generated by HashiCorp Vault.
              </p>
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '15px', borderRadius: '8px', marginTop: '15px' }}>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  <strong>⚠️ Security Notice:</strong>
                </p>
                <ul style={{ margin: '10px 0 0 0', paddingLeft: '20px', fontSize: '14px' }}>
                  <li>Each download generates a unique private key</li>
                  <li>Keys are ephemeral and can be rotated</li>
                  <li>Never share this file with others</li>
                  <li>Private keys are never hardcoded or stored in plaintext</li>
                </ul>
              </div>
            </div>

            {/* Download Button */}
            <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
              <h3 style={{ marginTop: 0 }}>Get WireGuard Configuration</h3>
              <button
                onClick={downloadVPNConfig}
                disabled={vpnLoading}
                style={{
                  padding: '15px 40px',
                  background: vpnLoading ? '#cbd5e0' : '#48bb78',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: vpnLoading ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold'
                }}
              >
                {vpnLoading ? '⏳ Generating...' : '📥 Download VPN Config'}
              </button>
              <p style={{ margin: '15px 0 0 0', color: '#718096', fontSize: '14px' }}>
                File will be named: zerotrust-vpn-{profile?.name?.replace(/\s+/g, '-')}.conf
              </p>
            </div>

            {/* VPN Usage Instructions */}
            <div className="card">
              <h3>📖 How to Use WireGuard</h3>
              
              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ color: '#667eea', marginBottom: '10px' }}>🖥️ Windows / macOS</h4>
                <ol style={{ paddingLeft: '20px', lineHeight: '1.8' }}>
                  <li>Download and install <a href="https://www.wireguard.com/install/" target="_blank" rel="noopener noreferrer" style={{ color: '#667eea' }}>WireGuard</a></li>
                  <li>Download your VPN config file using the button above</li>
                  <li>Open WireGuard app → "Add Tunnel" → "Import from file"</li>
                  <li>Select the downloaded .conf file</li>
                  <li>Click "Activate" to connect</li>
                  <li>Status will show "Active" when connected ✅</li>
                </ol>
              </div>

              <div style={{ marginBottom: '25px' }}>
                <h4 style={{ color: '#667eea', marginBottom: '10px' }}>🐧 Linux</h4>
                <div style={{ background: '#f7fafc', padding: '15px', borderRadius: '8px', fontFamily: 'monospace', fontSize: '13px', overflowX: 'auto' }}>
                  <div>sudo apt install wireguard</div>
                  <div>sudo cp zerotrust-vpn.conf /etc/wireguard/wg0.conf</div>
                  <div>sudo wg-quick up wg0</div>
                  <div style={{ marginTop: '10px', color: '#718096' }}># Verify connection:</div>
                  <div>ip addr show wg0</div>
                  <div>sudo wg show</div>
                </div>
              </div>

              <div>
                <h4 style={{ color: '#667eea', marginBottom: '10px' }}>✅ Verify Connection</h4>
                <div style={{ background: '#f7fafc', padding: '15px', borderRadius: '8px' }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}>Check your VPN IP address:</p>
                  <div style={{ background: '#e2e8f0', padding: '10px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px', marginBottom: '10px' }}>
                    curl https://api.ipify.org
                  </div>
                  <p style={{ margin: 0, fontSize: '14px', color: '#718096' }}>
                    Your VPN tunnel IP should be in the 10.8.0.0/24 range
                  </p>
                </div>
              </div>
            </div>

            {/* VPN Info */}
            <div className="card" style={{ background: '#f7fafc' }}>
              <h3>ℹ️ WireGuard Information</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                <div>
                  <strong>Protocol:</strong>
                  <p style={{ margin: '5px 0 0 0', color: '#718096' }}>WireGuard (Modern VPN Protocol)</p>
                </div>
                <div>
                  <strong>Encryption:</strong>
                  <p style={{ margin: '5px 0 0 0', color: '#718096' }}>Curve25519 + ChaCha20-Poly1305</p>
                </div>
                <div>
                  <strong>Performance:</strong>
                  <p style={{ margin: '5px 0 0 0', color: '#718096' }}>5x faster than OpenVPN</p>
                </div>
                <div>
                  <strong>Code Size:</strong>
                  <p style={{ margin: '5px 0 0 0', color: '#718096' }}>4,000 lines (vs OpenVPN 100,000+)</p>
                </div>
                <div>
                  <strong>Latency:</strong>
                  <p style={{ margin: '5px 0 0 0', color: '#718096' }}>~2ms (vs OpenVPN ~10ms)</p>
                </div>
                <div>
                  <strong>CPU Usage:</strong>
                  <p style={{ margin: '5px 0 0 0', color: '#718096' }}>3x lower than OpenVPN</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Company Tab */}
        {activeTab === 'company' && (
          <div>
            {/* Company Header */}
            <div className="card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white', marginBottom: '20px' }}>
              <h2 style={{ marginTop: 0 }}>🏢 {companyData?.company?.name}</h2>
              <p style={{ margin: 0, opacity: 0.9 }}>
                Department: <strong>{companyData?.company?.department}</strong> • Employees: <strong>{companyData?.company?.employees}</strong>
              </p>
            </div>

            {/* Company Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '20px' }}>
              <div className="card" style={{ background: '#f7fafc', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#667eea' }}>
                  {companyData?.company?.employees || 0}
                </div>
                <div style={{ color: '#718096', marginTop: '5px' }}>Total Employees</div>
              </div>
              <div className="card" style={{ background: '#f7fafc', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#48bb78' }}>
                  {companyData?.users?.filter(u => u.status === 'active').length || 0}
                </div>
                <div style={{ color: '#718096', marginTop: '5px' }}>Active Users</div>
              </div>
              <div className="card" style={{ background: '#f7fafc', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#ed8936' }}>
                  {companyData?.users?.filter(u => u.vpn_status === 'connected').length || 0}
                </div>
                <div style={{ color: '#718096', marginTop: '5px' }}>VPN Connected</div>
              </div>
              <div className="card" style={{ background: '#f7fafc', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#9f7aea' }}>
                  {companyData?.users?.filter(u => u.totp_enabled).length || 0}
                </div>
                <div style={{ color: '#718096', marginTop: '5px' }}>MFA Enabled</div>
              </div>
            </div>

            {/* Company Description */}
            {companyData?.company?.description && (
              <div className="card">
                <h3>About</h3>
                <p style={{ margin: 0, color: '#4a5568', lineHeight: '1.6' }}>
                  {companyData?.company?.description}
                </p>
              </div>
            )}

            {/* Departments */}
            {companyData?.company?.departments && companyData.company.departments.length > 0 && (
              <div className="card">
                <h3>Departments</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                  {companyData.company.departments.map((dept, idx) => (
                    <div key={idx} style={{ padding: '15px', background: '#f7fafc', borderRadius: '8px', borderLeft: '4px solid #667eea' }}>
                      <div style={{ fontWeight: 'bold', color: '#2d3748' }}>{dept}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Company Contact */}
            {companyData?.company?.contact && (
              <div className="card">
                <h3>Contact Information</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                  {companyData.company.contact.email && (
                    <div>
                      <strong>📧 Email</strong>
                      <p style={{ margin: '5px 0 0 0', color: '#4a5568' }}>
                        <a href={`mailto:${companyData.company.contact.email}`} style={{ color: '#667eea' }}>
                          {companyData.company.contact.email}
                        </a>
                      </p>
                    </div>
                  )}
                  {companyData.company.contact.phone && (
                    <div>
                      <strong>📱 Phone</strong>
                      <p style={{ margin: '5px 0 0 0', color: '#4a5568' }}>
                        {companyData.company.contact.phone}
                      </p>
                    </div>
                  )}
                  {companyData.company.contact.website && (
                    <div>
                      <strong>🌐 Website</strong>
                      <p style={{ margin: '5px 0 0 0', color: '#4a5568' }}>
                        <a href={companyData.company.contact.website} target="_blank" rel="noopener noreferrer" style={{ color: '#667eea' }}>
                          {companyData.company.contact.website}
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {/* Admin Panel Tab - Only for Giám Đốc */}
        {activeTab === 'admin' && permissions?.features?.user_management && (
          <div style={{ maxWidth: '1400px', margin: '30px auto' }}>
            <AdminPanel />
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: '500px', margin: '20px' }}>
            <h2 style={{ marginTop: 0 }}>Edit {editingItem.type}</h2>
            <div style={{ marginBottom: '20px' }}>
              {Object.keys(editForm).filter(key => !['id', 'employee_email', 'submitted_date'].includes(key)).map(key => (
                <div key={key} style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                    {key.replace(/_/g, ' ').toUpperCase()}
                  </label>
                  <input
                    type="text"
                    value={editForm[key] || ''}
                    onChange={(e) => setEditForm({ ...editForm, [key]: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '4px',
                      fontSize: '14px'
                    }}
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleSaveEdit}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#48bb78',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditingItem(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  background: '#cbd5e0',
                  color: '#2d3748',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default NewDashboard;
