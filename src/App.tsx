import React, { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { FlaskConical } from 'lucide-react'

const AuthPage = lazy(() => import('@/pages/AuthPage').then((m) => ({ default: m.AuthPage })))
const ExternalSupportSetupPage = lazy(() =>
  import('@/pages/ExternalSupportSetupPage').then((m) => ({ default: m.ExternalSupportSetupPage })),
)
const ClientDashboardPage = lazy(() =>
  import('@/pages/client/ClientDashboardPage').then((m) => ({ default: m.ClientDashboardPage })),
)
const NutritionistDashboardPage = lazy(() =>
  import('@/pages/nutritionist/NutritionistDashboardPage').then((m) => ({
    default: m.NutritionistDashboardPage,
  })),
)
const AdminDashboardPage = lazy(() =>
  import('@/pages/admin/AdminDashboardPage').then((m) => ({ default: m.AdminDashboardPage })),
)

const queryClient = new QueryClient()

function FullPageLoader() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
      <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center animate-pulse shadow-md">
        <FlaskConical className="w-6 h-6" />
      </div>
      <p className="text-xs font-semibold text-muted-foreground">Carregando ambiente clínico MyLabs...</p>
    </div>
  )
}

function RoleLandingRedirect() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return <FullPageLoader />
  }

  if (!user || !profile) {
    return <Navigate to="/login/cliente" replace />
  }

  if (profile.role === 'client') {
    return <Navigate to="/cliente" replace />
  }
  if (profile.role === 'admin') {
    return <Navigate to="/suporte" replace />
  }
  return <Navigate to="/nutri" replace />
}

function ProtectedRoute({
  allowedRoles,
  fallbackLoginPath,
  children,
}: {
  allowedRoles: ('client' | 'nutritionist' | 'admin')[]
  fallbackLoginPath: string
  children: React.ReactNode
}) {
  const { user, profile, loading } = useAuth()
  if (loading) return <FullPageLoader />
  if (!user || !profile) return <Navigate to={fallbackLoginPath} replace />
  if (!allowedRoles.includes(profile.role)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

const routerBasename =
  typeof window !== 'undefined' && window.location.pathname.startsWith('/mylabs')
    ? '/mylabs'
    : '/'

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter basename={routerBasename}>
            <Suspense fallback={<FullPageLoader />}>
              <Routes>
                <Route path="/" element={<RoleLandingRedirect />} />

                {/* Rotas específicas de login para cada perfil */}
                <Route path="/login" element={<Navigate to="/login/cliente" replace />} />
                <Route path="/login/cliente" element={<AuthPage portalRole="client" />} />
                <Route path="/login/nutri" element={<AuthPage portalRole="nutritionist" />} />
                <Route path="/login/nutricionista" element={<AuthPage portalRole="nutritionist" />} />
                <Route path="/login/suporte" element={<AuthPage portalRole="admin" />} />

                <Route path="/configurar-suporte" element={<ExternalSupportSetupPage />} />

                {/* Portal exclusivo do Cliente (isolado de Nutri e Suporte) */}
                <Route
                  path="/cliente"
                  element={
                    <ProtectedRoute allowedRoles={['client']} fallbackLoginPath="/login/cliente">
                      <ClientDashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* Módulo Clínico do Nutricionista */}
                <Route
                  path="/nutri"
                  element={
                    <ProtectedRoute allowedRoles={['nutritionist', 'admin']} fallbackLoginPath="/login/nutri">
                      <NutritionistDashboardPage />
                    </ProtectedRoute>
                  }
                />

                {/* Módulo de Suporte & Admin do Sistema */}
                <Route
                  path="/suporte"
                  element={
                    <ProtectedRoute allowedRoles={['admin']} fallbackLoginPath="/login/suporte">
                      <AdminDashboardPage />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster richColors position="bottom-right" />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  )
}
