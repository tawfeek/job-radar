// Axios client with auth-token injection. The token is kept in localStorage
// under "jobradar_token". On 401 we clear it so the next render bounces
// the user to /login.
import axios from 'axios';

const TOKEN_KEY = 'jobradar_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

const client = axios.create({ baseURL: '/api' });

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401) {
      setToken(null);
      // Hard reload to /login — easier than coordinating with React Router
      // from outside a component, and a 401 implies all in-flight state is
      // suspect anyway.
      if (window.location.pathname !== '/login') window.location.assign('/login');
    }
    return Promise.reject(err);
  }
);

export default client;
