import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AdminLayout } from './admin/AdminLayout';
import { ApiProvider, useMe } from './api';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { SignedInLayout } from './components/SignedInLayout';
import { ToastProvider } from './components/Toasts';
import { AccountPage } from './pages/AccountPage';
import { ErrorPage } from './pages/ErrorPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { OAuthConsentPage, OAuthLoginPage, OAuthLogoutPage } from './pages/OAuthPages';
import { SetupPage } from './pages/SetupPage';

// The admin pages load only when an admin opens them (their own bundle part); AdminLayout shows a fallback meanwhile
const AuditAdmin = lazy(() => import('./admin/AuditAdmin').then((m) => ({ default: m.AuditAdmin })));
const DevicesAdmin = lazy(() => import('./admin/DevicesAdmin').then((m) => ({ default: m.DevicesAdmin })));
const RightsAdmin = lazy(() => import('./admin/RightsAdmin').then((m) => ({ default: m.RightsAdmin })));
const RoomsAdmin = lazy(() => import('./admin/RoomsAdmin').then((m) => ({ default: m.RoomsAdmin })));
const UserDetail = lazy(() => import('./admin/UserDetail').then((m) => ({ default: m.UserDetail })));
const AppearancePage = lazy(() => import('./pages/AppearancePage').then((m) => ({ default: m.AppearancePage })));
const UsersAdmin = lazy(() => import('./admin/UsersAdmin').then((m) => ({ default: m.UsersAdmin })));

export function App() {
  const [queries] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  );
  return (
    <AuthProvider>
      <ApiProvider>
        <QueryClientProvider client={queries}>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/setup" element={<SetupPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route path="/error" element={<ErrorPage />} />
                <Route path="/oauth/login" element={<OAuthLoginPage />} />
                <Route path="/oauth/consent" element={<OAuthConsentPage />} />
                <Route path="/oauth/logout" element={<OAuthLogoutPage />} />
                <Route
                  element={
                    <RequireLogin>
                      <SignedInLayout />
                    </RequireLogin>
                  }
                >
                  <Route path="/" element={<HomePage />} />
                  <Route
                    path="/appearance"
                    element={
                      <Suspense fallback={<PageLoading />}>
                        <AppearancePage />
                      </Suspense>
                    }
                  />
                  <Route
                    path="/admin"
                    element={
                      <RequireAdmin>
                        <AdminLayout />
                      </RequireAdmin>
                    }
                  >
                    <Route index element={<Navigate to="devices" replace />} />
                    <Route path="devices" element={<DevicesAdmin />} />
                    <Route path="rooms" element={<RoomsAdmin />} />
                    <Route path="users" element={<UsersAdmin />} />
                    <Route path="users/:id" element={<UserDetail />} />
                    <Route path="rights" element={<RightsAdmin />} />
                    <Route path="audit" element={<AuditAdmin />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </QueryClientProvider>
      </ApiProvider>
    </AuthProvider>
  );
}

function RequireLogin({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === 'loading') {
    return <PageLoading />;
  }
  if (state.status !== 'signedIn') {
    return <Navigate to="/login" replace />;
  }
  return children;
}

/** Only for the interface; the backend refuses every admin request of others anyway. */
function RequireAdmin({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.isPending) {
    return <PageLoading />;
  }
  if (!me.data?.roles?.includes('admin')) {
    return <Navigate to="/" replace />;
  }
  return children;
}

/** While the session, the own account or a page loads: a calm spinner in the middle, readable for screen readers. */
function PageLoading() {
  return (
    <div className="page-loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">Lade …</span>
    </div>
  );
}
