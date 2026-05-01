export const environment = {
  production: true,
  apiUrl: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000' 
    : 'https://tsek.onrender.com'
};
