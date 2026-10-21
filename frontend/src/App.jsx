import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Layout from './components/Layout'
import Home from './pages/Home'
import Quiz from './pages/Quiz'
import Dashboard from './pages/Dashboard'
import StudyBuddy from './pages/StudyBuddy'

export default function App() {
  useEffect(() => {
    async function start() {
      if (!supabase) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously()
        if (error) console.warn('Anonymous sign-in failed:', error.message)
      }
    }
    start()
  }, [])

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/quiz" element={<Quiz />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/study-buddy" element={<StudyBuddy />} />
      </Route>
    </Routes>
  )
}