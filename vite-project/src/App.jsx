import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/feedback/ErrorBoundary'
import { ToastProvider } from './components/feedback/Toast'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { DashboardLayout } from './layouts/DashboardLayout'
import { ProtectedRoute, PublicRoute } from './layouts/ProtectedRoute'
import { ChangePasswordPage } from './pages/auth/ChangePasswordPage'
import { FirstRunSetupPage } from './pages/auth/FirstRunSetupPage'
import { LoginPage } from './pages/auth/LoginPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { EmployeeCreateEditPage } from './pages/employees/EmployeeCreateEditPage'
import { EmployeeDirectoryPage } from './pages/employees/EmployeeDirectoryPage'
import { EmployeeProfilePage } from './pages/employees/EmployeeProfilePage'
import { AttendanceBoardPage } from './pages/attendance/AttendanceBoardPage'
import { LeaveManagementPage } from './pages/leave/LeaveManagementPage'
import { PayrollPage } from './pages/payroll/PayrollPage'
import { PayslipPage } from './pages/payroll/PayslipPage'
import { AIAssistantPage } from './pages/ai/AIAssistantPage'
import { CommsAuditPage } from './pages/comms/CommsAuditPage'
import { OrganizationPage } from './pages/organization/OrganizationPage'
import { UsersPage } from './pages/organization/UsersPage'

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route
                  path="/setup"
                  element={
                    <PublicRoute setupOnly>
                      <FirstRunSetupPage />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <LoginPage />
                    </PublicRoute>
                  }
                />
                <Route element={<ProtectedRoute />}>
                  <Route path="/change-password" element={<ChangePasswordPage />} />
                </Route>
                <Route element={<ProtectedRoute />}>
                  <Route element={<DashboardLayout />}>
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/organization" element={<ProtectedRoute roles={['Admin', 'HR']} />}>
                      <Route index element={<OrganizationPage />} />
                    </Route>
                    <Route path="/users" element={<ProtectedRoute roles={['Admin']} />}>
                      <Route index element={<UsersPage />} />
                    </Route>
                    <Route path="/employees" element={<ProtectedRoute roles={['Admin', 'HR']} />}>
                      <Route index element={<EmployeeDirectoryPage />} />
                    </Route>
                    <Route path="/employees/new" element={<ProtectedRoute roles={['HR']} />}>
                      <Route index element={<EmployeeCreateEditPage />} />
                    </Route>
                    <Route path="/employees/:id/edit" element={<ProtectedRoute roles={['HR']} />}>
                      <Route index element={<EmployeeCreateEditPage />} />
                    </Route>
                    <Route path="/employees/:id" element={<EmployeeProfilePage />} />
                    <Route path="/attendance" element={<AttendanceBoardPage />} />
                    <Route path="/leave" element={<LeaveManagementPage />} />
                    <Route path="/payroll" element={<PayrollPage />} />
                    <Route path="/payroll/payslips/:runId/:employeeId" element={<PayslipPage />} />
                    <Route path="/ai-assistant" element={<AIAssistantPage />} />
                    <Route path="/comms" element={<CommsAuditPage />} />
                  </Route>
                </Route>
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}
