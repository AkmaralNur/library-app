import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Toast from '../components/ui/Toast';

const ToastContext = createContext(null);

// Показать уведомление: const toast = useToast(); toast('Готово') или toast('Ошибка', true)
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }) {
  const [message, setMessage] = useState(null);
  const timer = useRef(null);
  const nextId = useRef(0);

  const toast = useCallback((text, isError = false) => {
    nextId.current += 1;
    setMessage({ id: nextId.current, text, isError });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3500);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {message && <Toast key={message.id} text={message.text} isError={message.isError} />}
    </ToastContext.Provider>
  );
}
