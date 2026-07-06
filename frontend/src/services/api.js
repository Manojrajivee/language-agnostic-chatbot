import axios from 'axios';

const BASE_URL = 'http://localhost:8000/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Configure token on startup if it exists in local storage
const token = localStorage.getItem('lingua_bot_token');
if (token) {
  api.defaults.headers.common['Authorization'] = `Token ${token}`;
}

// Clear local storage and reset headers if the server returns 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[API] Stale token detected. Clearing local auth storage...');
      localStorage.removeItem('lingua_bot_token');
      localStorage.removeItem('lingua_bot_username');
      delete api.defaults.headers.common['Authorization'];
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

/**
 * Auth API endpoints
 */
export const signup = async (username, email, password) => {
  const response = await api.post('/auth/signup/', { username, email, password });
  return response.data;
};

export const login = async (username, password) => {
  const response = await api.post('/auth/login/', { username, password });
  const data = response.data;
  if (data.token) {
    localStorage.setItem('lingua_bot_token', data.token);
    api.defaults.headers.common['Authorization'] = `Token ${data.token}`;
  }
  return data;
};

export const logout = async () => {
  await api.post('/auth/logout/');
  localStorage.removeItem('lingua_bot_token');
  delete api.defaults.headers.common['Authorization'];
};

/**
 * Password Reset & Email Verification endpoints
 */
export const requestPasswordReset = (email) =>
  api.post('/auth/password-reset/', { email });

export const confirmPasswordReset = (uid, token, newPassword) =>
  api.post('/auth/password-reset/confirm/', { uid, token, new_password: newPassword });

export const requestVerificationEmail = (username) =>
  api.post('/auth/verify-email/', { username });

export const confirmEmailVerification = (uid, token) =>
  api.post('/auth/verify-email/confirm/', { uid, token });

/**
 * Conversations API endpoints
 */
export const createConversation = (sessionId) =>
  api.post('/conversations/', { session_id: sessionId });

export const getHistory = (sessionId) =>
  api.get(`/chat/${sessionId}/history/`);

export const getUserConversations = () =>
  api.get('/conversations/user/');

export const linkGuestConversation = (sessionId) =>
  api.post('/conversations/link-guest/', { session_id: sessionId });

/**
 * File Upload API
 */
export const uploadFile = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post('/chat/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * Send a message via REST (fallback when WebSocket is unavailable).
 */
export const sendMessage = (sessionId, message, overrideLanguage = '', attachmentPath = '', attachmentName = '') =>
  api.post(`/chat/${sessionId}/send/`, { 
    message, 
    override_language: overrideLanguage,
    attachment_path: attachmentPath,
    attachment_name: attachmentName
  });

/**
 * Utility endpoints
 */
export const detectLanguage = (text) =>
  api.post('/detect-language/', { text });

export const getLanguageStats = () =>
  api.get('/stats/languages/');

export const updateConversation = (sessionId, data) =>
  api.patch(`/conversations/${sessionId}/`, data);

export const deleteConversation = (sessionId) =>
  api.delete(`/conversations/${sessionId}/`);

export const duplicateConversation = (sessionId) =>
  api.post(`/conversations/${sessionId}/duplicate/`);

export const rateMessage = (messageId, isLiked) =>
  api.post(`/messages/${messageId}/react/`, { is_liked: isLiked });

export default api;
