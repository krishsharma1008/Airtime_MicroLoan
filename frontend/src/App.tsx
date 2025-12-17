import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import UserScreen from './screens/UserScreen'
import CockpitScreen from './screens/CockpitScreen'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/cockpit" replace />} />
        <Route path="/consent" element={<UserScreen />} />
        <Route path="/cockpit" element={<CockpitScreen />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


