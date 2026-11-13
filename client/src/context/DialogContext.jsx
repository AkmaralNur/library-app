import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const DialogContext = createContext(null);

// Какие окна открыты: open('book', 5) открывает карточку книги №5, close('book') закрывает её.
// Сами окна перечислены в components/dialogs/DialogHost.jsx
export const useDialogs = () => useContext(DialogContext);

export function DialogProvider({ children }) {
  const [dialogs, setDialogs] = useState({});

  const open = useCallback((name, value = true) => setDialogs((d) => ({ ...d, [name]: value })), []);
  const close = useCallback((name) => setDialogs((d) => ({ ...d, [name]: null })), []);
  const closeAll = useCallback(() => setDialogs({}), []);

  const value = useMemo(() => ({ dialogs, open, close, closeAll }), [dialogs, open, close, closeAll]);
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}
