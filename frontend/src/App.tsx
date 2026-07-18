import { FC } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import LoginPage from './pages/LoginPage'
import ChatPage from './pages/ChatPage'
import ImagePage from './pages/ImagePage'
import GalleryPage from './pages/GalleryPage'
import AdminPage from './pages/AdminPage'

function App() {
  const { isAuthenticated } = useAuthStore()

  return (
    <Routes>
      <Route path="/login" element={!isAuthenticated ? <LoginPage /> : <Navigate to="/chat" />} />
      <Route path="/chat" element={isAuthenticated ? <ChatPage /> : <Navigate to="/login" />} />
      <Route path="/image" element={isAuthenticated ? <ImagePage /> : <Navigate to="/login" />} />
      <Route path="/gallery" element={isAuthenticated ? <GalleryPage /> : <Navigate to="/login" />} />
      <Route path="/admin" element={isAuthenticated ? <AdminPage /> : <Navigate to="/login" />} />
      <Route path="/" element={<Navigate to="/chat" />} />
    </Routes>
  )
}

export default App
