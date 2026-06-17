import { useState } from 'react';
import Login from './app/layout/auth/login';
import AppLayout from './app/layout/AppLayout';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <Login onSuccess={() => setIsAuthenticated(true)} />;
  }

  return <AppLayout />;
}
