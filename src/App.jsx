import { Routes, Route } from 'react-router-dom'
import Login from './components/Login'
import AuthorizedLayout from './components/AuthorizedLayout'
import AdminPanel from './components/AdminPanel'
import ProtectedRoute from './components/ProtectedRoute'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AuthorizedLayout />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPanel />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
