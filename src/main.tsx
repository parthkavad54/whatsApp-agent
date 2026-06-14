import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './context/LanguageContext';

// Silence benign HMR network connection WebSocket errors (expected since HMR is disabled by the sandbox platform)
if (typeof window !== 'undefined') {
  const isWebsocketError = (err: any): boolean => {
    if (!err) return false;
    const str = String(err.message || err.reason || err);
    return str.includes('WebSocket') || str.includes('websocket') || str.includes('WebSocket connection');
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isWebsocketError(event.reason) || isWebsocketError(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (isWebsocketError(event.error) || isWebsocketError(event.message) || isWebsocketError(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);

