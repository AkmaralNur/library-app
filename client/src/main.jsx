import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { DialogProvider } from './context/DialogContext';
import { SessionProvider } from './context/SessionContext';
import { ToastProvider } from './context/ToastContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <SessionProvider>
        <DialogProvider>
          <App />
        </DialogProvider>
      </SessionProvider>
    </ToastProvider>
  </StrictMode>,
);
