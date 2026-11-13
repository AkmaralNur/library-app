import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api';

const SessionContext = createContext(null);

// Текущий пользователь, настройки сервера и сигнал «данные изменились, загрузите заново»
export const useSession = () => useContext(SessionContext);

export function SessionProvider({ children }) {
  const [me, setMe] = useState(null);
  const [config, setConfig] = useState(null);
  const [failed, setFailed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    Promise.all([api.get('/api/config'), api.get('/api/me')])
      .then(([cfg, user]) => {
        setConfig(cfg);
        setMe(user);
      })
      .catch(() => setFailed(true));
  }, []);

  if (failed) return <p className="p-6 text-center text-danger">Не удалось связаться с сервером. Проверьте, что он запущен.</p>;
  if (!config) return null;

  const value = {
    me,
    setMe,
    config,
    refreshKey,
    refresh,
    isLibrarian: me?.role === 'librarian',
    isReader: me?.role === 'reader',
  };
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
