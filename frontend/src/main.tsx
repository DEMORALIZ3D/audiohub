import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { fetchServerBranding } from './config/branding';

import { getServerBaseUrl, isStandaloneApp, resolveApiUrl } from './utils/apiConfig';

// Fetch and sync custom server branding (App Name, Logo, Tagline)
// Global API & user profile interceptor
const originalFetch = window.fetch;
window.fetch = (input: RequestInfo | URL, init: RequestInit = {}) => {
  // Resolve relative URLs (/api/v1/...) against configured server base URL
  let resolvedInput = input;
  const isApiRequest =
    (typeof input === 'string' &&
      (input.startsWith('/api/') || input.startsWith('/rest/') || input.startsWith('/stream/'))) ||
    (input instanceof URL &&
      (input.pathname.startsWith('/api/') ||
        input.pathname.startsWith('/rest/') ||
        input.pathname.startsWith('/stream/')));

  if (isApiRequest && isStandaloneApp() && !getServerBaseUrl()) {
    return Promise.reject(
      new Error(
        'AudioHub server not configured. Please tap Connect to configure your server address.',
      ),
    );
  }

  if (typeof input === 'string' && input.startsWith('/')) {
    resolvedInput = resolveApiUrl(input);
  } else if (input instanceof URL && input.pathname.startsWith('/')) {
    resolvedInput = resolveApiUrl(input.pathname + input.search);
  }

  const userId = localStorage.getItem('audiohub_user_id');
  if (userId) {
    const headers = new Headers(init.headers || {});
    headers.set('X-User-Id', userId);
    headers.set('Authorization', `Bearer ${userId}`);
    init.headers = headers;

    // For GET requests on standalone/cross-origin, append user_id query param
    // to provide zero-preflight CORS compatibility
    const method = (init.method || 'GET').toUpperCase();
    if (
      method === 'GET' &&
      typeof resolvedInput === 'string' &&
      !resolvedInput.includes('user_id=')
    ) {
      const sep = resolvedInput.includes('?') ? '&' : '?';
      resolvedInput = `${resolvedInput}${sep}user_id=${encodeURIComponent(userId)}`;
    }
  }
  return originalFetch(resolvedInput, init);
};

// Fetch and sync custom server branding (App Name, Logo, Tagline)
fetchServerBranding();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
