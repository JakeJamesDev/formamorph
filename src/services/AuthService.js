class AuthService {
  constructor() {
    // Use different API URL based on environment
    this.API_URL = import.meta.env.MODE === 'production' 
      ? import.meta.env.VITE_API_URL_PROD
      : import.meta.env.VITE_API_URL_DEV;
    this.tokenKey = 'authToken';
    this.userKey = 'currentUser';
    this.token = localStorage.getItem(this.tokenKey);
    this.currentUser = JSON.parse(localStorage.getItem(this.userKey) || 'null');
  }

  isAuthenticated() {
    return !!this.token;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  async login(username, password) {
    try {
      const response = await fetch(`${this.API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }
      
      const data = await response.json();
      console.log('Login response data:', data);
      
      this.token = data.token;
      localStorage.setItem(this.tokenKey, this.token);
      
      // If the login response includes user data, store it
      if (data.user) {
        this.currentUser = data.user;
        localStorage.setItem(this.userKey, JSON.stringify(data.user));
      } else {
        // Otherwise, fetch user profile
        await this.fetchUserProfile();
      }
      
      return true;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  async register(username, password, email = '') {
    try {
      // Validate username and password according to server requirements
      if (!username || username.length < 3 || username.length > 20) {
        throw new Error('Username must be between 3 and 20 characters');
      }
      
      if (!password || password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      // Validate email format if provided
      if (email && !this.isValidEmail(email)) {
        throw new Error('Invalid email format');
      }
      
      const requestBody = { username, password };
      if (email) {
        requestBody.email = email;
      }
      
      const response = await fetch(`${this.API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Registration failed');
      }
      
      const data = await response.json();
      console.log('Registration response data:', data);
      
      this.token = data.token;
      localStorage.setItem(this.tokenKey, this.token);
      
      // If the registration response includes user data, store it
      if (data.user) {
        this.currentUser = data.user;
        localStorage.setItem(this.userKey, JSON.stringify(data.user));
      } else {
        // Otherwise, fetch user profile
        await this.fetchUserProfile();
      }
      
      // If we still don't have a username, create a basic user object with the username
      if (!this.currentUser || !this.currentUser.username) {
        this.currentUser = { username };
        localStorage.setItem(this.userKey, JSON.stringify(this.currentUser));
      }
      
      return true;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  }

  async fetchUserProfile() {
    try {
      if (!this.token) return null;
      
      const response = await fetch(`${this.API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired or invalid
          this.logout();
          return null;
        }
        throw new Error('Failed to fetch user profile');
      }
      
      const userData = await response.json();
      console.log('User profile data:', userData);
      
      // Handle different possible response structures
      let userObject = userData;
      if (userData.user) {
        userObject = userData.user;
      }
      
      // Ensure we have a username
      if (!userObject.username && this.currentUser && this.currentUser.username) {
        userObject.username = this.currentUser.username;
      }
      
      this.currentUser = userObject;
      localStorage.setItem(this.userKey, JSON.stringify(userObject));
      
      return userObject;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      
      // If we have a username from login/register, create a basic user object
      if (!this.currentUser || !this.currentUser.username) {
        const storedUser = JSON.parse(localStorage.getItem(this.userKey) || 'null');
        if (storedUser && storedUser.username) {
          this.currentUser = storedUser;
        }
      }
      
      return this.currentUser;
    }
  }

  async changePassword(currentPassword, newPassword) {
    try {
      if (!this.token) throw new Error('Not authenticated');
      
      const response = await fetch(`${this.API_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to change password');
      }
      
      return true;
    } catch (error) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  // Validate email format
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  logout() {
    this.token = null;
    this.currentUser = null;
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }
}

export default new AuthService();
