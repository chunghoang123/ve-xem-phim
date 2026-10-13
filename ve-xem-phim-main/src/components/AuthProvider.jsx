import { useCallback, useEffect, useState } from "react";
import { api, clearTokens, setTokens } from "../lib/api";
import { AuthContext } from "../lib/auth-context";

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch {
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setTokens(res.data);
    setUser(res.data.user);
    return res.data.user;
  };

  const completeExternalLogin = (authResult) => {
    setTokens(authResult);
    setUser(authResult.user);
    return authResult.user;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Local logout must still complete if the network is unavailable.
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch {
      // Keep the current user visible if refresh temporarily fails.
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, completeExternalLogin, logout, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}
