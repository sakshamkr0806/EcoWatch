import { createContext, useContext, useState } from 'react';
import { authService } from '../services/auth.service';

// Keeps the logged-in user in React state and localStorage so a page
// refresh keeps the session. Real token handling comes from the backend.
const AuthContext = createContext(null);

const USER_KEY = 'ems_user';
const TOKEN_KEY = 'ems_token';

function readSession() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  const persist = ({ user: nextUser, token }) => {
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    localStorage.setItem(TOKEN_KEY, token);
    setUser(nextUser);
    return nextUser;
  };

  const login = async (email, password) => persist(await authService.login(email, password));
  const register = async (payload) => persist(await authService.register(payload));

  const logout = () => {
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  };

  // Role check helper: hasRole('ADMIN', 'OPERATOR')
  const hasRole = (...roles) => Boolean(user && roles.includes(user.role));

  return (
    <AuthContext.Provider value={{ user, login, register, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
