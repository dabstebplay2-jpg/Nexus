import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { UserMemoryProvider } from './context/UserMemoryContext';
import { ArtifactProvider } from './context/ArtifactContext';
import AuthModal from './components/auth/AuthModal';
const SettingsModal = lazy(() => import('./components/settings/SettingsModal'));
import ChatPage from './pages/ChatPage';
import SpacesPage from './pages/SpacesPage';
import DashboardPage from './pages/DashboardPage';
import PricingPage from './pages/PricingPage';
import RequisitesPage from './pages/RequisitesPage';
import OfferPage from './pages/OfferPage';
import PrivacyPage from './pages/PrivacyPage';
import IdeDownloadPage from './pages/IdeDownloadPage';
import IdeExtensionDownloadPage from './pages/IdeExtensionDownloadPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import IdeAuthBridgePage from './pages/IdeAuthBridgePage';
import BrowserAuthBridgePage from './pages/BrowserAuthBridgePage';
import UpdatesPage from './pages/UpdatesPage';

const ArtifactsPage = lazy(() => import('./pages/ArtifactsPage'));
const IdeLitePage = lazy(() => import('./pages/IdeLitePage'));
const ConnectorsPage = lazy(() => import('./pages/ConnectorsPage'));
const ConnectorsCallbackPage = lazy(() => import('./pages/ConnectorsCallbackPage'));

function RouteFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center text-sm text-zinc-500">
      Загрузка…
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UserMemoryProvider>
        <ArtifactProvider>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path="/" element={<ChatPage />} />
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
          <Route path="/ide" element={<IdeDownloadPage />} />
          <Route path="/ide/extension/nexus-ai" element={<IdeExtensionDownloadPage />} />
          <Route path="/ide/lite" element={<IdeLitePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/auth/ide-login" element={<IdeAuthBridgePage />} />
          <Route path="/auth/browser-login" element={<BrowserAuthBridgePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        <AuthModal />
        <Suspense fallback={null}>
          <SettingsModal />
        </Suspense>
        </ArtifactProvider>
        </UserMemoryProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
