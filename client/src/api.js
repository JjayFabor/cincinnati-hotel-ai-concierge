async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      ...options,
      headers: options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json', ...options.headers } : options.headers,
    });
  } catch {
    throw Object.assign(new Error('Network error — please check your connection.'), { status: 0 });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Request failed (${res.status})`), { status: res.status, fields: data.fields });
  return data;
}

export const api = {
  chat: (payload) => request('/api/chat', { method: 'POST', body: JSON.stringify(payload) }),
  contact: (payload) => request('/api/contact', { method: 'POST', body: JSON.stringify(payload) }),
  stats: (fresh = false) => request(`/api/admin/stats${fresh ? '?fresh=1' : ''}`),

  // XHR instead of fetch so the admin sees real upload progress.
  upload(file, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);
      xhr.open('POST', '/api/admin/upload');
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.upload.onload = () => onProgress?.(1);
      xhr.onload = () => {
        let data = {};
        try { data = JSON.parse(xhr.responseText); } catch { /* ignore */ }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.error || `Upload failed (${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error('Network error during upload.'));
      xhr.send(form);
    });
  },
};

export function newSessionId() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'sess_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}
