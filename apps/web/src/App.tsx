import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { AdminLayout } from './admin/AdminLayout';
import { AuditAdmin } from './admin/AuditAdmin';
import { DevicesAdmin } from './admin/DevicesAdmin';
import { RightsAdmin } from './admin/RightsAdmin';
import { RoomsAdmin } from './admin/RoomsAdmin';
import { UserDetail } from './admin/UserDetail';
import { UsersAdmin } from './admin/UsersAdmin';
import { ApiProvider, useMe } from './api';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { SignedInLayout } from './components/SignedInLayout';
import { ToastProvider } from './components/Toasts';
import { AccountPage } from './pages/AccountPage';
import { ErrorPage } from './pages/ErrorPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { SetupPage } from './pages/SetupPage';

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
                <Route
                  element={
                    <RequireLogin>
                      <SignedInLayout />
                    </RequireLogin>
                  }
                >
                  <Route path="/" element={<HomePage />} />
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
    return <p className="muted center">Lade …</p>;
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
    return <p className="muted center">Lade …</p>;
  }
  if (!me.data?.roles?.includes('admin')) {
    return <Navigate to="/" replace />;
  }
  return children;
}
