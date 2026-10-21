import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { ensureSession } from './lib/session'
import Layout from './components/Layout'
import Home from './pages/Home'
import Quiz from './pages/Quiz'
import Dashboard from './pages/Dashboard'
import StudyBuddy from './pages/StudyBuddy'
import NotFound from './pages/NotFound'

export default function App() {
  useEffect(() => {
    ensureSession().catch((e) => console.warn('Anonymous sign-in failed:', e.message))
  }, [])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/study-buddy" element={<StudyBuddy />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}