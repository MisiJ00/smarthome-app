import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';

import { ApiProvider } from './api';
import { AuthProvider, useAuth } from './auth/AuthProvider';
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
                  path="/"
                  element={
                    <RequireLogin>
                      <HomePage />
                    </RequireLogin>
                  }
                />
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
