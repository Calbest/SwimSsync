import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import CreateAccount from './pages/CreateAccount.tsx'
import SignIn from './pages/SignIn.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Settings from './pages/Settings.tsx'
import Compare from './pages/Compare.tsx'
import Qualifications from './pages/Qualifications.tsx'
import Goals from './pages/Goals.tsx'
import CreateGoal from './pages/CreateGoal.tsx'
import Import from './pages/Import.tsx'
import Progress from './pages/Progress.tsx'
import EventPlanning from './pages/EventPlanning.tsx'
import Calendar from './pages/Calendar.tsx'
import RaceLibrary from './pages/RaceLibrary.tsx'
import Friends from './pages/Friends.tsx'
import PublicProfile from './pages/Profile.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/qualifications" element={<Qualifications />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/goals/create" element={<CreateGoal />} />
        <Route path="/import" element={<Import />} />
        <Route path="/progress" element={<Progress />} />
        <Route path="/event-planning" element={<EventPlanning />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/race-library" element={<RaceLibrary />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/profile/:userId" element={<PublicProfile />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
