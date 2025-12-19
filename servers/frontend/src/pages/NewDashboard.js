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
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [profileRes, permissionsRes, companyDataRes] = await Promise.all([
        api.get('/user/profile'),
        api.get('/user/permissions'),
        api.get('/company/data')
      ]);
      
      setProfile(profileRes.data);
      setPermissions(permissionsRes.data);
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

  const downloadVPNConfig = async () => {
    try {
      setVpnLoading(true);
      setError('');
      
      const mfaToken = localStorage.getItem('mfa_token');
      
      if (!mfaToken) {
        setError('Session expired. Please login again.');
        setVpnLoading(false);
        return;
      }
      
      console.log('Requesting VPN config with MFA token');
      
      const response = await api.post('/vpn/config', {
        mfa_token: mfaToken
      });
      
      const configContent = response.data.config;
      
      const blob = new Blob([configContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `vpn-${profile?.email?.split('@')[0] || 'user'}.conf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      setVpnConfig(configContent);
      setError('');
    } catch (err) {
      console.error('VPN config error:', err);
      setError(err.response?.data?.error || 'Failed to generate VPN config');
    } finally {
      setVpnLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '50px 20px' }}>
        <div className="card" style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center', padding: '40px' }}>
          <div className="spinner"></div>
          <p style={{ marginTop: '20px', color: '#666' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0', padding: '16px 0' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '20px', color: '#333' }}>Dashboard</h2>
              <p style={{ margin: '4px 0 0 0', color: '#666', fontSize: '14px' }}>{profile?.email}</p>
            </div>
            <button onClick={handleLogout} style={{
              padding: '8px 16px',
              background: '#fff',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#333'
            }}>
              Logout
            </button>
          </div>
        </div>
      </div>

      <div style={{ background: '#fff', borderBottom: '1px solid #e0e0e0' }}>
        <div className="container" style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', gap: '0' }}>
            {['profile', 'vpn', 'company', permissions?.features?.user_management && 'admin'].filter(Boolean).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '12px 24px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #4CAF50' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: activeTab === tab ? '#4CAF50' : '#666',
                  fontWeight: activeTab === tab ? '600' : '400'
                }}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container" style={{ maxWidth: '1200px', margin: '30px auto', padding: '0 20px' }}>
        {error && (
          <div style={{
            background: '#fee',
            border: '1px solid #fcc',
            color: '#c00',
            padding: '12px 16px',
            borderRadius: '4px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        {activeTab === 'profile' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div className="card">
                <h3 style={{ marginTop: 0, fontSize: '16px', color: '#333', marginBottom: '16px' }}>User Information</h3>
                <table style={{ width: '100%', fontSize: '14px' }}>
                  <tbody>
                    <tr><td style={{ padding: '8px 0', color: '#666', width: '40%' }}>Name</td><td style={{ fontWeight: '600' }}>{profile?.name}</td></tr>
                    <tr><td style={{ padding: '8px 0', color: '#666' }}>Email</td><td>{profile?.email}</td></tr>
                    <tr><td style={{ padding: '8px 0', color: '#666' }}>Department</td><td>{profile?.department || 'Engineering'}</td></tr>
                    <tr><td style={{ padding: '8px 0', color: '#666' }}>Role</td><td>{profile?.role_display || permissions?.role?.display_name || 'User'}</td></tr>
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0, fontSize: '16px', color: '#333', marginBottom: '16px' }}>Permissions</h3>
                <table style={{ width: '100%', fontSize: '14px' }}>
                  <tbody>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#666' }}>VPN Access</td>
                      <td><span style={{ color: permissions?.vpn_enabled ? '#4CAF50' : '#f44336' }}>{permissions?.vpn_enabled ? 'Enabled' : 'Disabled'}</span></td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#666' }}>Company Data</td>
                      <td><span style={{ color: permissions?.company_access ? '#4CAF50' : '#f44336' }}>{permissions?.company_access ? 'Yes' : 'No'}</span></td>
                    </tr>
                    <tr>
                      <td style={{ padding: '8px 0', color: '#666' }}>MFA Status</td>
                      <td><span style={{ color: permissions?.totp_enabled ? '#4CAF50' : '#ff9800' }}>{permissions?.totp_enabled ? 'Active' : 'Inactive'}</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="card">
                <h3 style={{ marginTop: 0, fontSize: '16px', color: '#333', marginBottom: '16px' }}>Company</h3>
                <table style={{ width: '100%', fontSize: '14px' }}>
                  <tbody>
                    <tr><td style={{ padding: '8px 0', color: '#666', width: '40%' }}>Name</td><td style={{ fontWeight: '600' }}>{companyData?.company?.name || 'Zero Trust Corp'}</td></tr>
                    <tr><td style={{ padding: '8px 0', color: '#666' }}>Department</td><td>{companyData?.company?.department || profile?.department}</td></tr>
                    <tr><td style={{ padding: '8px 0', color: '#666' }}>Employees</td><td>{companyData?.company?.employees || 150}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vpn' && (
          <div style={{ maxWidth: '800px' }}>
            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '18px' }}>VPN Configuration</h3>
              <p style={{ color: '#666', marginBottom: '20px', fontSize: '14px' }}>
                Download your WireGuard VPN configuration file.
              </p>
              
              <button
                onClick={downloadVPNConfig}
                disabled={vpnLoading || !permissions?.vpn_enabled}
                style={{
                  padding: '12px 24px',
                  background: vpnLoading || !permissions?.vpn_enabled ? '#ccc' : '#4CAF50',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: vpnLoading || !permissions?.vpn_enabled ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
              >
                {vpnLoading ? 'Generating...' : 'Download VPN Config'}
              </button>

              {!permissions?.vpn_enabled && (
                <p style={{ color: '#f44336', marginTop: '12px', fontSize: '14px' }}>
                  VPN access is disabled for your account.
                </p>
              )}

              {vpnConfig && (
                <div style={{ marginTop: '24px' }}>
                  <h4 style={{ fontSize: '14px', marginBottom: '12px' }}>Configuration File</h4>
                  <pre style={{
                    background: '#f5f5f5',
                    padding: '16px',
                    borderRadius: '4px',
                    overflow: 'auto',
                    fontSize: '12px',
                    border: '1px solid #ddd'
                  }}>
                    {vpnConfig}
                  </pre>
                </div>
              )}
            </div>

            <div className="card" style={{ marginTop: '20px' }}>
              <h4 style={{ marginTop: 0, fontSize: '16px', marginBottom: '12px' }}>Installation</h4>
              <div style={{ fontSize: '14px', color: '#666', lineHeight: '1.6' }}>
                <p><strong>Windows/macOS:</strong></p>
                <ol style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>Install WireGuard from wireguard.com</li>
                  <li>Open WireGuard, click Add Tunnel and import the downloaded config file</li>
                  <li>Click Activate to connect</li>
                </ol>

                <p style={{ marginTop: '16px' }}><strong>Linux:</strong></p>
                <pre style={{ background: '#f5f5f5', padding: '12px', borderRadius: '4px', fontSize: '12px', overflow: 'auto' }}>
{`sudo apt install wireguard
sudo cp vpn-config.conf /etc/wireguard/wg0.conf
sudo wg-quick up wg0`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'company' && (
          <div className="card">
            <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '16px' }}>Company Information</h3>
            <div style={{ fontSize: '14px', color: '#666' }}>
              <p><strong>Company:</strong> {companyData?.company?.name || 'Zero Trust Corp'}</p>
              <p><strong>Department:</strong> {companyData?.company?.department || profile?.department}</p>
              <p><strong>Total Employees:</strong> {companyData?.company?.employees || 150}</p>
            </div>
          </div>
        )}

        {activeTab === 'admin' && permissions?.features?.user_management && (
          <AdminPanel />
        )}
      </div>
    </div>
  );
}

export default NewDashboard;
