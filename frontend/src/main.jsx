import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import './index.css';
import { initAppearance } from './lib/theme.js';

initAppearance();

// A production build can register a service worker. When the same hostname is later
// used for local development an old worker/cache may keep serving stale chunks and
// make secondary routes fail with "Failed to fetch dynamically imported module".
// Development must always run from Vite itself, so clean those leftovers once.
if (import.meta.env.DEV && typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  }
  if ('caches' in window) {
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('nexus-')).map((key) => caches.delete(key))))
      .catch(() => {});
  }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
