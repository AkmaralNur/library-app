import { useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext';
import { useToast } from '../context/ToastContext';

// Загружает данные при появлении компонента, при изменении deps и после каждого refresh().
// Пока данных нет, возвращает null.
export function useLoad(loader, deps = [], onError = null) {
  const { refreshKey } = useSession();
  const toast = useToast();
  const [data, setData] = useState(null);

  useEffect(() => {
    let active = true;
    loader()
      .then((result) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (!active) return;
        toast(err.message, true);
        onError?.();
      });
    return () => {
      active = false; // ответ устаревшего запроса игнорируем
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, ...deps]);

  return data;
}
