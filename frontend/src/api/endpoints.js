// One function per API route (Assessment 1 §4). Components never call fetch directly.
import { apiRequest } from './client.js';

const query = (params = {}) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return entries.length ? `?${new URLSearchParams(entries)}` : '';
};

export const healthApi = {
  check: (options) => apiRequest('/health', { timeoutMs: 8_000, ...options }),
};

export const authApi = {
  login: (credentials) => apiRequest('/auth/login', { method: 'POST', body: credentials }),
  register: (details) => apiRequest('/auth/register', { method: 'POST', body: details }),
};

export const usersApi = {
  me: (options) => apiRequest('/users/me', options),
  updateMe: (changes) => apiRequest('/users/me', { method: 'PATCH', body: changes }),
};

export const partiesApi = {
  list: (options) => apiRequest('/parties', options),
  create: (party) => apiRequest('/parties', { method: 'POST', body: party }),
  get: (partyId, options) => apiRequest(`/parties/${partyId}`, options),
  stats: (partyId, options) => apiRequest(`/parties/${partyId}/stats`, options),
  remove: (partyId) => apiRequest(`/parties/${partyId}`, { method: 'DELETE' }),
  addMember: (partyId, email) => apiRequest(`/parties/${partyId}/members`, { method: 'POST', body: { email } }),
  removeMember: (partyId, userId) => apiRequest(`/parties/${partyId}/members/${userId}`, { method: 'DELETE' }),
};

export const tasksApi = {
  listMine: (params, options) => apiRequest(`/tasks${query(params)}`, options),
  listForParty: (partyId, params, options) => apiRequest(`/parties/${partyId}/tasks${query(params)}`, options),
  create: (partyId, task) => apiRequest(`/parties/${partyId}/tasks`, { method: 'POST', body: task }),
  update: (partyId, taskId, changes) => apiRequest(`/parties/${partyId}/tasks/${taskId}`, { method: 'PATCH', body: changes }),
  remove: (partyId, taskId) => apiRequest(`/parties/${partyId}/tasks/${taskId}`, { method: 'DELETE' }),
};
