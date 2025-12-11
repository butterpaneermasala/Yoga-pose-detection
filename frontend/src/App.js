import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { App as CapacitorApp } from '@capacitor/app'

import Home from './pages/Home/Home'
import Yoga from './pages/Yoga/Yoga'
import About from './pages/About/About'
import Tutorials from './pages/Tutorials/Tutorials'

import './App.css'

function AppContent() {
  const navigate = useNavigate()

  useEffect(() => {
    // Handle Android back button
    const backButtonListener = CapacitorApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        // If we can go back in history, navigate back
        navigate(-1)
      } else {
        // If we're at home page, minimize app instead of closing
        CapacitorApp.minimizeApp()
      }
    })

    return () => {
      backButtonListener.remove()
    }
  }, [navigate])

  return (
    <Routes>
      <Route path='/' element={<Home />} />
      <Route path='/yoga' element={<Yoga />} />
      <Route path='/about' element={<About />} />
      <Route path='/tutorials' element={<Tutorials />} />
    </Routes>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;


