// src/pages/Dashboard.jsx
import { useAuth } from '../context/AuthContext';

export function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div>
      <p>
        Welcome, {user.name} (role: {user.role})
      </p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}