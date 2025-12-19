import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

function AdminPanel() {
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    role: 'employee'
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const profileRes = await api.get('/user/profile');
      const permRes = await api.get('/user/permissions');
      
      if (!permRes.data.features?.user_management) {
        navigate('/dashboard');
        return;
      }

      setPermissions(permRes.data);
      loadUsers();
      loadLogs();
    } catch (err) {
      navigate('/login');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.users || []);
      setLoading(false);
    } catch (err) {
      setError('Failed to load users');
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const response = await api.get('/admin/logs?limit=50');
      setLogs(response.data.logs || []);
      setStats(response.data.stats);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  };

  const handleCreateUser = async () => {
    try {
      setError('');
      setSuccess('');
      
      if (!newUser.email || !newUser.password) {
        setError('Email and password required');
        return;
      }

      await api.post('/admin/users', newUser);
      
      setSuccess(`User ${newUser.email} created successfully`);
      setShowCreateModal(false);
      setNewUser({ email: '', password: '', role: 'employee' });
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    }
  };

  const handleRevokeAccess = async (user) => {
    if (!window.confirm(`Revoke VPN access for ${user.email}? They will need to re-setup TOTP.`)) return;
    
    try {
      setError('');
      setSuccess('');
      const response = await api.post(`/api/admin/users/${user.id}/revoke`);
      setSuccess(response.data.message);
      loadUsers();
      loadLogs();
    } catch (err) {
      setError('Failed to revoke access');
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`Delete user ${user.email} permanently?`)) return;
    
    try {
      setError('');
      setSuccess('');
      await api.delete(`/api/admin/users/${user.id}`);
      setSuccess(`User ${user.email} deleted`);
      loadUsers();
      loadLogs();
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  const getRoleBadge = (role) => {
    const colors = {
      'employee': '#3182ce',
      'manager': '#805ad5',
      'admin': '#e53e3e',
      'contractor': '#dd6b20',
      'dba': '#38a169'
    };
    return colors[role] || '#718096';
  };

  const getStatusBadge = (status) => {
    return status === 'active' ? '#48bb78' : status === 'revoked' ? '#f56565' : '#718096';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString('vi-VN');
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading Admin Panel...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>👑 Admin Panel</h1>
        <button onClick={() => navigate('/dashboard')} style={styles.btnSecondary}>
          ← Back to Dashboard
        </button>
      </div>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Tabs */}
      <div style={styles.tabs}>
        <button 
          onClick={() => setActiveTab('users')} 
          style={{...styles.tab, ...(activeTab === 'users' ? styles.tabActive : {})}}
        >
          👥 Users ({users.length})
        </button>
        <button 
          onClick={() => setActiveTab('logs')} 
          style={{...styles.tab, ...(activeTab === 'logs' ? styles.tabActive : {})}}
        >
          📋 Audit Logs ({logs.length})
        </button>
        <button 
          onClick={() => setActiveTab('stats')} 
          style={{...styles.tab, ...(activeTab === 'stats' ? styles.tabActive : {})}}
        >
          📊 Statistics
        </button>
      </div>

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2>User Management</h2>
            <button onClick={() => setShowCreateModal(true)} style={styles.btnPrimary}>
              + Create User
            </button>
          </div>

          <div style={{overflowX: 'auto'}}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={styles.th}>Role</th>
                  <th style={styles.th}>Department</th>
                  <th style={styles.th}>VPN IP</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Last Login</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div>
                        <strong>{user.name}</strong>
                        <div style={{fontSize: '12px', color: '#718096'}}>{user.position}</div>
                      </div>
                    </td>
                    <td style={styles.td}>{user.email}</td>
                    <td style={styles.td}>
                      <span style={{...styles.badge, backgroundColor: getRoleBadge(user.role)}}>
                        {user.role.toUpperCase()}
                      </span>
                    </td>
                    <td style={styles.td}>{user.department}</td>
                    <td style={styles.td}>
                      <code style={{fontSize: '12px'}}>{user.vpn_ip || 'N/A'}</code>
                    </td>
                    <td style={styles.td}>
                      <div>
                        <span style={{...styles.badge, backgroundColor: getStatusBadge(user.status)}}>
                          {user.status}
                        </span>
                        <div style={{fontSize: '11px', color: '#718096', marginTop: '4px'}}>
                          {user.totp_enabled ? '🔐 TOTP' : '⚠️ No MFA'}
                        </div>
                        <div style={{fontSize: '11px', color: user.vpn_status === 'connected' ? '#48bb78' : '#718096'}}>
                          VPN: {user.vpn_status || 'N/A'}
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <div style={{fontSize: '12px'}}>{formatDate(user.last_login)}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={{display: 'flex', gap: '8px', flexDirection: 'column'}}>
                        {user.status === 'active' && (
                          <button 
                            onClick={() => handleRevokeAccess(user)} 
                            style={{...styles.btnSmall, ...styles.btnWarning}}
                          >
                            🚫 Revoke
                          </button>
                        )}
                        <button 
                          onClick={() => handleDeleteUser(user)} 
                          style={{...styles.btnSmall, ...styles.btnDanger}}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h2>Audit Logs</h2>
            <button onClick={loadLogs} style={styles.btnSecondary}>
              🔄 Refresh
            </button>
          </div>

          {stats && (
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{stats.total}</div>
                <div style={styles.statLabel}>Total Events</div>
              </div>
              <div style={styles.statCard}>
                <div style={{...styles.statValue, color: '#48bb78'}}>{stats.success}</div>
                <div style={styles.statLabel}>Success</div>
              </div>
              <div style={styles.statCard}>
                <div style={{...styles.statValue, color: '#f56565'}}>{stats.failed}</div>
                <div style={styles.statLabel}>Failed</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{stats.unique_users}</div>
                <div style={styles.statLabel}>Unique Users</div>
              </div>
            </div>
          )}

          <div style={styles.logContainer}>
            {logs.length === 0 ? (
              <div style={{textAlign: 'center', padding: '40px', color: '#718096'}}>
                No logs found
              </div>
            ) : (
              logs.map((log, index) => (
                <div key={index} style={styles.logEntry}>
                  <div style={styles.logTime}>{formatDate(log.timestamp)}</div>
                  <div style={styles.logContent}>
                    <span style={{fontWeight: 'bold'}}>{log.username}</span>
                    <span style={{margin: '0 8px'}}>→</span>
                    <span style={styles.logAction}>{log.action}</span>
                    <span style={{
                      ...styles.badge, 
                      backgroundColor: log.status === 'success' ? '#48bb78' : '#f56565',
                      marginLeft: '12px'
                    }}>
                      {log.status}
                    </span>
                  </div>
                  {log.details && (
                    <div style={styles.logDetails}>{log.details}</div>
                  )}
                  <div style={styles.logMeta}>
                    IP: {log.ip || 'N/A'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Stats Tab */}
      {activeTab === 'stats' && (
        <div style={styles.card}>
          <h2>System Statistics</h2>
          
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{users.filter(u => u.status === 'active').length}</div>
              <div style={styles.statLabel}>Active Users</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{users.filter(u => u.vpn_status === 'connected').length}</div>
              <div style={styles.statLabel}>Connected VPN</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{users.filter(u => u.totp_enabled).length}</div>
              <div style={styles.statLabel}>MFA Enabled</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{users.filter(u => u.status === 'revoked').length}</div>
              <div style={styles.statLabel}>Revoked</div>
            </div>
          </div>

          <div style={{marginTop: '30px'}}>
            <h3>Resources Access Matrix</h3>
            {users.filter(u => u.status === 'active').map(user => (
              <div key={user.id} style={styles.resourceCard}>
                <div style={styles.resourceHeader}>
                  <strong>{user.name}</strong> ({user.role})
                </div>
                <div style={styles.resourceList}>
                  {user.allowed_resources && user.allowed_resources.length > 0 ? (
                    user.allowed_resources.map((resource, idx) => (
                      <div key={idx} style={styles.resourceItem}>
                        ✓ {resource}
                      </div>
                    ))
                  ) : (
                    <div style={{color: '#f56565'}}>No resources assigned</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2>Create New User</h2>
            <input
              type="email"
              placeholder="Email"
              value={newUser.email}
              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              style={styles.input}
            />
            <input
              type="password"
              placeholder="Password"
              value={newUser.password}
              onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              style={styles.input}
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({...newUser, role: e.target.value})}
              style={styles.input}
            >
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
              <option value="contractor">Contractor</option>
              <option value="dba">DBA</option>
            </select>
            <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
              <button onClick={handleCreateUser} style={styles.btnPrimary}>
                Create
              </button>
              <button onClick={() => setShowCreateModal(false)} style={styles.btnSecondary}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
    paddingBottom: '20px',
    borderBottom: '2px solid #e2e8f0'
  },
  title: {
    fontSize: '32px',
    margin: 0,
    color: '#2d3748'
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '20px',
    borderBottom: '2px solid #e2e8f0'
  },
  tab: {
    padding: '12px 24px',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '16px',
    fontWeight: '500',
    color: '#718096',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#3182ce',
    borderBottom: '3px solid #3182ce'
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '20px'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse'
  },
  th: {
    textAlign: 'left',
    padding: '12px',
    borderBottom: '2px solid #e2e8f0',
    color: '#4a5568',
    fontWeight: '600',
    fontSize: '14px'
  },
  tr: {
    borderBottom: '1px solid #e2e8f0'
  },
  td: {
    padding: '12px',
    fontSize: '14px'
  },
  badge: {
    padding: '4px 12px',
    borderRadius: '12px',
    color: 'white',
    fontSize: '12px',
    fontWeight: '600',
    display: 'inline-block'
  },
  btnPrimary: {
    padding: '10px 20px',
    background: '#3182ce',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px'
  },
  btnSecondary: {
    padding: '10px 20px',
    background: '#e2e8f0',
    color: '#2d3748',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: '600',
    fontSize: '14px'
  },
  btnSmall: {
    padding: '6px 12px',
    background: '#4299e1',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: '600'
  },
  btnWarning: {
    background: '#ed8936'
  },
  btnDanger: {
    background: '#f56565'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
    marginBottom: '30px'
  },
  statCard: {
    background: '#f7fafc',
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#2d3748'
  },
  statLabel: {
    fontSize: '14px',
    color: '#718096',
    marginTop: '8px'
  },
  logContainer: {
    maxHeight: '600px',
    overflowY: 'auto',
    marginTop: '20px'
  },
  logEntry: {
    padding: '16px',
    background: '#f7fafc',
    borderRadius: '8px',
    marginBottom: '12px',
    borderLeft: '4px solid #3182ce'
  },
  logTime: {
    fontSize: '12px',
    color: '#718096',
    marginBottom: '8px'
  },
  logContent: {
    fontSize: '14px',
    color: '#2d3748',
    marginBottom: '8px'
  },
  logAction: {
    fontFamily: 'monospace',
    background: '#e2e8f0',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '13px'
  },
  logDetails: {
    fontSize: '13px',
    color: '#4a5568',
    marginTop: '8px',
    fontStyle: 'italic'
  },
  logMeta: {
    fontSize: '11px',
    color: '#a0aec0',
    marginTop: '8px'
  },
  resourceCard: {
    background: '#f7fafc',
    padding: '16px',
    borderRadius: '8px',
    marginBottom: '12px'
  },
  resourceHeader: {
    marginBottom: '12px',
    color: '#2d3748',
    fontSize: '16px'
  },
  resourceList: {
    paddingLeft: '20px'
  },
  resourceItem: {
    fontSize: '14px',
    color: '#48bb78',
    marginBottom: '6px'
  },
  modal: {
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
  },
  modalContent: {
    background: 'white',
    padding: '30px',
    borderRadius: '12px',
    minWidth: '400px',
    maxWidth: '500px'
  },
  input: {
    width: '100%',
    padding: '12px',
    marginBottom: '16px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    boxSizing: 'border-box'
  },
  error: {
    background: '#fed7d7',
    color: '#c53030',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  success: {
    background: '#c6f6d5',
    color: '#22543d',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  loading: {
    textAlign: 'center',
    padding: '100px',
    fontSize: '18px',
    color: '#718096'
  }
};

export default AdminPanel;
