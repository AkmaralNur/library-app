// Все запросы к бэкенду проходят через этот файл

async function request(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Ошибка сервера');
  return data;
}

const send = (method) => (url, data) => request(url, { method, body: JSON.stringify(data) });

export const api = {
  get: (url) => request(url),
  post: send('POST'),
  put: send('PUT'),
  delete: send('DELETE'),
};
