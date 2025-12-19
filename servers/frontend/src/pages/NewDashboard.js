import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AdminPanel from './AdminPanel';

function NewDashboard() {
  const [profile, setProfile] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [companyData, setCompanyData] = useState(null);
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
            {['overview', 'requests', 'timesheets', 'projects', 'expenses'].map(tab => (
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
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
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

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
              <div className="card" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>Pending Requests</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>
                  {companyData?.leave_requests?.filter(r => r.employee_email === profile?.email && r.status === 'pending').length || 0}
                </p>
              </div>
              
              <div className="card" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>Hours This Week</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>
                  {companyData?.timesheets?.filter(t => t.employee_email === profile?.email)
                    .reduce((sum, t) => sum + (t.hours_worked || 0), 0).toFixed(1)}h
                </p>
              </div>
              
              <div className="card" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>Active Projects</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>
                  {companyData?.projects?.filter(p => p.team_members?.includes(profile?.email)).length || 0}
                </p>
              </div>
              
              <div className="card" style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
                <h3 style={{ margin: '0 0 10px 0' }}>Pending Expenses</h3>
                <p style={{ fontSize: '36px', fontWeight: 'bold', margin: 0 }}>
                  {companyData?.expenses?.filter(e => e.employee_email === profile?.email && e.status === 'pending').length || 0}
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h2 style={{ marginTop: 0 }}>Quick Actions</h2>
              <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handleCreateRequest('Annual Leave')}
                  style={{
                    padding: '12px 24px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  📝 Request Leave
                </button>
                <button
                  onClick={() => setActiveTab('timesheets')}
                  style={{
                    padding: '12px 24px',
                    background: '#48bb78',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  ⏰ Log Time
                </button>
                <button
                  onClick={() => setActiveTab('expenses')}
                  style={{
                    padding: '12px 24px',
                    background: '#ed8936',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold'
                  }}
                >
                  💰 Submit Expense
                </button>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="card" style={{ marginTop: '20px' }}>
              <h2 style={{ marginTop: 0 }}>Recent Activity</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {companyData?.leave_requests?.filter(r => r.employee_email === profile?.email).slice(0, 3).map(request => (
                  <div key={request.id} style={{ 
                    padding: '15px', 
                    background: '#f7fafc', 
                    borderRadius: '8px',
                    borderLeft: `4px solid ${request.status === 'approved' ? '#48bb78' : request.status === 'pending' ? '#ed8936' : '#f56565'}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>{request.type}</strong> - {request.days} day(s)
                        <p style={{ margin: '5px 0 0 0', color: '#718096', fontSize: '14px' }}>
                          {request.start_date} to {request.end_date}
                        </p>
                      </div>
                      <span style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: request.status === 'approved' ? '#c6f6d5' : request.status === 'pending' ? '#feebc8' : '#fed7d7',
                        color: request.status === 'approved' ? '#22543d' : request.status === 'pending' ? '#7c2d12' : '#742a2a'
                      }}>
                        {request.status.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Leave Requests Tab */}
        {activeTab === 'requests' && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0 }}>Leave Requests</h2>
              <button
                onClick={() => handleCreateRequest('Annual Leave')}
                style={{
                  padding: '10px 20px',
                  background: '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                + New Request
              </button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Start Date</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>End Date</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Days</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {companyData?.leave_requests?.filter(r => 
                  permissions?.role?.level === 'full' || 
                  permissions?.features?.approve_requests || 
                  r.employee_email === profile?.email
                ).map(request => (
                  <tr key={request.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px' }}>{request.type}</td>
                    <td style={{ padding: '12px' }}>{request.start_date}</td>
                    <td style={{ padding: '12px' }}>{request.end_date}</td>
                    <td style={{ padding: '12px' }}>{request.days}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: request.status === 'approved' ? '#c6f6d5' : request.status === 'pending' ? '#feebc8' : '#fed7d7',
                        color: request.status === 'approved' ? '#22543d' : request.status === 'pending' ? '#7c2d12' : '#742a2a'
                      }}>
                        {request.status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '12px' }}>
                      {canEdit(request) && (
                        <button
                          onClick={() => handleEdit(request, 'leave_requests')}
                          style={{
                            padding: '6px 12px',
                            background: '#4299e1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            marginRight: '5px'
                          }}
                        >
                          Edit
                        </button>
                      )}
                      {canDelete() && (
                        <button
                          onClick={() => handleDelete(request.id, 'leave_requests')}
                          style={{
                            padding: '6px 12px',
                            background: '#f56565',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Timesheets Tab */}
        {activeTab === 'timesheets' && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>My Timesheets</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Check In</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Check Out</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Hours</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Project</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Notes</th>
                </tr>
              </thead>
              <tbody>
                {companyData?.timesheets?.filter(t => t.employee_email === profile?.email).map(timesheet => (
                  <tr key={timesheet.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px' }}>{timesheet.date}</td>
                    <td style={{ padding: '12px' }}>{timesheet.check_in}</td>
                    <td style={{ padding: '12px' }}>{timesheet.check_out}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{timesheet.hours_worked}h</td>
                    <td style={{ padding: '12px' }}>{timesheet.project}</td>
                    <td style={{ padding: '12px', color: '#718096' }}>{timesheet.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>My Projects</h2>
            <div style={{ display: 'grid', gap: '20px' }}>
              {companyData?.projects?.filter(p => p.team_members?.includes(profile?.email)).map(project => (
                <div key={project.id} style={{ 
                  padding: '20px', 
                  background: '#f7fafc', 
                  borderRadius: '8px',
                  borderLeft: '4px solid #667eea'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '15px' }}>
                    <div>
                      <h3 style={{ margin: '0 0 5px 0' }}>{project.name}</h3>
                      <p style={{ margin: 0, color: '#718096' }}>{project.description}</p>
                    </div>
                    <span style={{
                      padding: '5px 12px',
                      borderRadius: '20px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      background: project.status === 'active' ? '#c6f6d5' : '#feebc8',
                      color: project.status === 'active' ? '#22543d' : '#7c2d12'
                    }}>
                      {project.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '14px' }}>
                      <span>Progress</span>
                      <span style={{ fontWeight: 'bold' }}>{project.progress}%</span>
                    </div>
                    <div style={{ 
                      width: '100%', 
                      height: '8px', 
                      background: '#e2e8f0', 
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${project.progress}%`, 
                        height: '100%', 
                        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                        transition: 'width 0.3s'
                      }}></div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '30px', fontSize: '14px', color: '#718096' }}>
                    <div>
                      <strong>Start:</strong> {project.start_date}
                    </div>
                    <div>
                      <strong>Deadline:</strong> {project.deadline}
                    </div>
                    <div>
                      <strong>Budget:</strong> {(project.budget / 1000000).toFixed(0)}M VND
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expenses Tab */}
        {activeTab === 'expenses' && (
          <div className="card">
            <h2 style={{ marginTop: 0 }}>Expense Claims</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Category</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Amount</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {companyData?.expenses?.filter(e => 
                  permissions?.role?.level === 'full' || 
                  permissions?.features?.view_financials || 
                  e.employee_email === profile?.email
                ).map(expense => (
                  <tr key={expense.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '12px' }}>{expense.date}</td>
                    <td style={{ padding: '12px' }}>{expense.category}</td>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{expense.amount.toLocaleString()} VND</td>
                    <td style={{ padding: '12px', color: '#718096' }}>{expense.description}</td>
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        background: expense.status === 'approved' ? '#c6f6d5' : expense.status === 'pending' ? '#feebc8' : '#fed7d7',
                        color: expense.status === 'approved' ? '#22543d' : expense.status === 'pending' ? '#7c2d12' : '#742a2a'
                      }}>
                        {expense.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
