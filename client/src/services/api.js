/**
 * client/src/services/api.js - Unified API Client
 */

async function request(url, options = {}) {
  const config = {
    ...options,
    credentials: 'include',
    cache: 'no-store', // Ensures dynamic API requests never stall on 304 or browser cache
    headers: {
      'Content-Type': 'application/json',
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache',
      ...options.headers
    }
  };

  if (config.body && typeof config.body === 'object' && !(config.body instanceof FormData)) {
    config.body = JSON.stringify(config.body);
  } else if (config.body instanceof FormData) {
    // Let browser set the multipart Content-Type header automatically
    delete config.headers['Content-Type'];
  }

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));

  if (!response.ok && response.status !== 304) {
    let errorMsg = data.message;
    if (!errorMsg) {
      if (response.status === 404) {
        errorMsg = 'अनुरोधित डेटा या सेवा नहीं मिली (404)।';
      } else if (response.status === 403) {
        errorMsg = 'इस कार्य को करने के लिए अनुमति (Permission) नहीं है।';
      } else if (response.status === 401) {
        errorMsg = 'सत्र समाप्त हो गया है, कृपया पुनः लॉगिन करें।';
      } else {
        errorMsg = `अनुरोध पूरा नहीं हो सका (Status: ${response.status})।`;
      }
    }
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

export const api = {
  get: (url, params) => {
    let finalUrl = url;
    if (params) {
      const q = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, v);
        }
      });
      const qs = q.toString();
      if (qs) finalUrl += (url.includes('?') ? '&' : '?') + qs;
    }
    return request(finalUrl, { method: 'GET' });
  },

  post: (url, body, options = {}) => {
    return request(url, { method: 'POST', body, ...options });
  },

  put: (url, body, options = {}) => {
    return request(url, { method: 'PUT', body, ...options });
  },

  delete: (url, body) => {
    return request(url, { method: 'DELETE', body });
  }
};

