import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

const Login = () => {
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Modified API call - let backend determine role automatically
      const res = await axios.post('/api/auth/login', {
        identifier: form.identifier,
        password: form.password
      });
      
      const { token, tokens, user } = res.data;
      
      // Store tokens and user info - use new token structure if available
      if (tokens) {
        localStorage.setItem('accessToken', tokens.accessToken);
        localStorage.setItem('token', tokens.accessToken); // Ensure compatibility
        localStorage.setItem('refreshToken', tokens.refreshToken);
      } else {
        // Fallback to legacy token format
        localStorage.setItem('accessToken', token);
        localStorage.setItem('token', token); // Ensure compatibility
      }
  localStorage.setItem('user', JSON.stringify(user));
  localStorage.setItem('userData', JSON.stringify(user)); // Ensure compatibility with ScheduleClassesTab.js
      
      // Redirect based on user role
      const roleRoutes = {
        superadmin: '/superadmin/dashboard',
        admin: '/admin/dashboard',
        tutor: '/tutor/dashboard',
        parent: '/parent/dashboard',
        student: '/student/dashboard'
      };
      
      window.location.href = roleRoutes[user.role] || '/dashboard';
      
    } catch (err) {
      console.log('Login error details:', err);
      console.log('Error response:', err.response);
      setError(err.response?.data?.error || err.message || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* Header Section */}
        <div className="login-header">
          <div className="logo">
            <i className="fas fa-graduation-cap"></i>
            <h1>EduPlatform</h1>
          </div>
          <p className="tagline">Welcome back! Please sign in to your account</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="identifier">
              <i className="fas fa-user"></i>
              Email or Username
            </label>
            <input
              type="text"
              id="identifier"
              name="identifier"
              placeholder="Enter your email or username"
              value={form.identifier}
              onChange={handleChange}
              required
              className={error ? 'error' : ''}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">
              <i className="fas fa-lock"></i>
              Password
            </label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={handleChange}
                required
                className={error ? 'error' : ''}
                disabled={loading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={togglePasswordVisibility}
                disabled={loading}
              >
                <i className={showPassword ? 'fas fa-eye-slash' : 'fas fa-eye'}></i>
              </button>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <i className="fas fa-exclamation-circle"></i>
              {error}
            </div>
          )}

          <button 
            type="submit" 
            className="login-button"
            disabled={loading || !form.identifier || !form.password}
          >
            {loading ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                Signing In...
              </>
            ) : (
              <>
                <i className="fas fa-sign-in-alt"></i>
                Sign In
              </>
            )}
          </button>

          <div className="form-footer">
            <a href="/forgot-password" className="forgot-password">
              <i className="fas fa-question-circle"></i>
              Forgot your password?   
            </a>
            <br /> <br /> 
            <p className="register-link-text">
              Don't have an account? 
              <a href="/registration" className="register-link">
                <i className="fas fa-user-plus"></i>
                Create Account
              </a>
            </p>
          </div>
        </form>

        {/* Demo Credentials Section */}
        <div className="demo-section">
          <h3>Demo Credentials</h3>
          <div className="demo-grid">
            <div className="demo-card" onClick={() => setForm({identifier: 'superadmin@education.com', password: 'superadmin123'})}>
              <i className="fas fa-crown"></i>
              <span>Super Admin</span>
            </div>
            <div className="demo-card" onClick={() => setForm({identifier: 'karthik_kvp@yahoo.com', password: 'admin123'})}>
              <i className="fas fa-user-shield"></i>
              <span>Admin</span>
            </div>
            <div className="demo-card" onClick={() => setForm({identifier: 'testmy@testmy.com', password: 'Password@123'})}>
              <i className="fas fa-chalkboard-teacher"></i>
              <span>Tutor</span>
            </div>
            <div className="demo-card" onClick={() => setForm({identifier: 'karthhik_kvp@yahoo.com', password: 'student123'})}>
              <i className="fas fa-user-graduate"></i>
              <span>Student</span>
            </div>
            <div className="demo-card" onClick={() => setForm({identifier: 'parent@education.com', password: 'parent123'})}>
              <i className="fas fa-users"></i>
              <span>Parent</span>
            </div>
          </div>
          <p className="demo-note">Click any card to auto-fill credentials</p>
        </div>
      </div>

      {/* Background Elements */}
      <div className="bg-elements">
        <div className="circle circle-1"></div>
        <div className="circle circle-2"></div>
        <div className="circle circle-3"></div>
      </div>
    </div>
  );
};

export default Login;
