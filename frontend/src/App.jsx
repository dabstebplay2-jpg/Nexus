import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UserMemoryProvider } from './context/UserMemoryContext';
import { ArtifactProvider } from './context/ArtifactContext';
import RouteErrorBoundary from './components/RouteErrorBoundary';
import ChatPage from './pages/ChatPage';

const CHUNK_RETRY_PREFIX = 'nexus_chunk_retry_';

function lazyWithRetry(loader, name) {
  return lazy(async () => {
    try {
      const module = await loader();
      try {
        sessionStorage.removeItem(`${CHUNK_RETRY_PREFIX}${name}`);
      } catch {
        /* storage may be disabled */
      }
      return module;
    } catch (error) {
      const message = String(error?.message || error || '');
      const looksLikeChunkFailure =
        /dynamically imported module|importing a module script failed|failed to fetch/i.test(message);
      if (looksLikeChunkFailure && typeof window !== 'undefined') {
        const key = `${CHUNK_RETRY_PREFIX}${name}`;
        let retried = false;
        try {
          retried = sessionStorage.getItem(key) === '1';
          if (!retried) sessionStorage.setItem(key, '1');
        } catch {
          retried = true;
        }
        if (!retried) window.location.reload();
      }
      throw error;
    }
  });
}

const AuthModal = lazyWithRetry(() => import('./components/auth/AuthModal'), 'auth-modal');
const SettingsModal = lazyWithRetry(() => import('./components/settings/SettingsModal'), 'settings-modal');
const SpacesPage = lazyWithRetry(() => import('./pages/SpacesPage'), 'spaces');
const DashboardPage = lazyWithRetry(() => import('./pages/DashboardPage'), 'dashboard');
const PricingPage = lazyWithRetry(() => import('./pages/PricingPage'), 'pricing');
const RequisitesPage = lazyWithRetry(() => import('./pages/RequisitesPage'), 'requisites');
const OfferPage = lazyWithRetry(() => import('./pages/OfferPage'), 'offer');
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'), 'privacy');
const IdeDownloadPage = lazyWithRetry(() => import('./pages/IdeDownloadPage'), 'ide-download');
const BrowserDownloadPage = lazyWithRetry(() => import('./pages/BrowserDownloadPage'), 'browser-download');
const IdeExtensionDownloadPage = lazyWithRetry(
  () => import('./pages/IdeExtensionDownloadPage'),
  'ide-extension'
);
const AuthCallbackPage = lazyWithRetry(() => import('./pages/AuthCallbackPage'), 'auth-callback');
const IdeAuthBridgePage = lazyWithRetry(() => import('./pages/IdeAuthBridgePage'), 'ide-auth');
const BrowserAuthBridgePage = lazyWithRetry(() => import('./pages/BrowserAuthBridgePage'), 'browser-auth');
const UpdatesPage = lazyWithRetry(() => import('./pages/UpdatesPage'), 'updates');
const ArtifactsPage = lazyWithRetry(() => import('./pages/ArtifactsPage'), 'artifacts');
const IdeLitePage = lazyWithRetry(() => import('./pages/IdeLitePage'), 'ide-lite');
const ConnectorsPage = lazyWithRetry(() => import('./pages/ConnectorsPage'), 'connectors');
const ConnectorsCallbackPage = lazyWithRetry(
  () => import('./pages/ConnectorsCallbackPage'),
  'connectors-callback'
);

function RouteFallback() {
  return (
    <div className="nx-route-loading" role="status" aria-live="polite">
      <span className="nx-route-loading__dot" />
      <span>Открываю раздел…</span>
    </div>
  );
}

function AppRoutes() {
  const location = useLocation();

  return (
    <RouteErrorBoundary routeKey={location.pathname}>
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location}>
          <Route path="/" element={<ChatPage />} />
          <Route path="/no-code" element={<ChatPage experience="nocode" />} />
          <Route path="/chat" element={<Navigate to="/" replace />} />
          <Route path="/spaces" element={<SpacesPage />} />
          <Route path="/artifacts" element={<ArtifactsPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/requisites" element={<RequisitesPage />} />
          <Route path="/offer" element={<OfferPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/updates" element={<UpdatesPage />} />
          <Route path="/connectors" element={<ConnectorsPage />} />
          <Route path="/connectors/callback" element={<ConnectorsCallbackPage />} />
          <Route path="/profile" element={<DashboardPage />} />
          <Route path="/dashboard" element={<Navigate to="/profile" replace />} />
          <Route path="/browser" element={<BrowserDownloadPage />} />
          <Route path="/ide" element={<IdeDownloadPage />} />
          <Route path="/ide/extension/nexus-ai" element={<IdeExtensionDownloadPage />} />
          <Route path="/ide/lite" element={<IdeLitePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/ide-login" element={<IdeAuthBridgePage />} />
          <Route path="/auth/browser-login" element={<BrowserAuthBridgePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </RouteErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UserMemoryProvider>
          <ArtifactProvider>
            <AppRoutes />
            <Suspense fallback={null}>
              <AuthModal />
              <SettingsModal />
            </Suspense>
          </ArtifactProvider>
        </UserMemoryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
