import { useCallback, useEffect, useState } from "react";
import { api, getTokenValue, setToken } from "../lib/api";
import { AuthContext } from "../lib/auth-context";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    const token = getTokenValue();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch {
      setToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const loginWithPhone = async (phone, password) => {
    const res = await api.post('/auth/login', { phone, password });
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data.user;
  };

  const logout = () => { setToken(null); setUser(null); };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch {
      // Keep the current user visible if refresh temporarily fails.
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, loginWithPhone, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
