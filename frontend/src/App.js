import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'

import Home from './pages/Home/Home'
import Yoga from './pages/Yoga/Yoga'
import About from './pages/About/About'
import Tutorials from './pages/Tutorials/Tutorials'
import Progress from './pages/Progress/Progress'
import Flows from './pages/Flows/Flows'
import Settings from './pages/Settings/Settings'
import Auth from './pages/Auth/Auth'

import './App.css'

function AppContent() {
  return (
    <Routes>
      <Route path='/auth' element={<Auth />} />
      <Route path='/' element={
        <ProtectedRoute>
          <Home />
        </ProtectedRoute>
      } />
      <Route path='/yoga' element={
        <ProtectedRoute>
          <Yoga />
        </ProtectedRoute>
      } />
      <Route path='/about' element={
        <ProtectedRoute>
          <About />
        </ProtectedRoute>
      } />
      <Route path='/tutorials' element={
        <ProtectedRoute>
          <Tutorials />
        </ProtectedRoute>
      } />
      <Route path='/progress' element={
        <ProtectedRoute>
          <Progress />
        </ProtectedRoute>
      } />
      <Route path='/flows' element={
        <ProtectedRoute>
          <Flows />
        </ProtectedRoute>
      } />
      <Route path='/settings' element={
        <ProtectedRoute>
          <Settings />
        </ProtectedRoute>
      } />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;


