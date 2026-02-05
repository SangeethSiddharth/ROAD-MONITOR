import React, { useEffect, useState } from 'react';
import { Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signInAnonymously, User } from 'firebase/auth';
import { auth } from './services/firebase';
import Dashboard from './pages/Dashboard';
import MapPage from './pages/MapPage';
import RTIPage from './pages/RTIPage';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Anonymous auth for ease of use
        try {
          const result = await signInAnonymously(auth);
          setUser(result.user);
        } catch (error) {
          console.error('Auth error:', error);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="app" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '1rem' }}>Loading RoadWatch...</p>
      </div>
    );
  }

  return (
    <div className="app">
      <nav className="nav">
        <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">🚴</span>
          <span>Ride</span>
        </NavLink>
        <NavLink to="/map" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">🗺️</span>
          <span>Map</span>
        </NavLink>
        <NavLink to="/rti" className={({ isActive }) => isActive ? 'active' : ''}>
          <span className="nav-icon">📄</span>
          <span>RTI</span>
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard userId={user?.uid || ''} />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/rti" element={<RTIPage userId={user?.uid || ''} />} />
      </Routes>
    </div>
  );
}

export default App;
