import { useEffect, useState } from 'react';

// Возвращает значение с задержкой, чтобы не слать запрос на каждую букву
export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
