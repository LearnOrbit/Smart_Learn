import { useEffect, useState, ReactNode } from "react";
import { apiClient } from "@/integrations/api/client";
import { AuthContext, type AppRole, type AuthUser } from "@/hooks/AuthContext";

const API_BASE_URL = import.meta.env.VITE_API_URL?.replace(/\/api$/, "") || "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ access_token: string } | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = sessionStorage.getItem("auth_token");
    if (token) {
      apiClient.setToken(token);
      setSession({ access_token: token });
      fetchMe(token);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchMe = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        sessionStorage.removeItem("auth_token");
        apiClient.clearToken();
        setSession(null);
        setUser(null);
        setRole(null);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const u: AuthUser = {
        id: data.id,
        email: data.email,
        name: data.name || data.full_name || "",
        role: data.role,
      };
      setUser(u);
      setRole(u.role as AppRole);
    } catch {
      sessionStorage.removeItem("auth_token");
      apiClient.clearToken();
      setSession(null);
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Login failed");

    const token = data.access_token;
    sessionStorage.setItem("auth_token", token);
    apiClient.setToken(token);
    setSession({ access_token: token });

    const u: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name || data.user.full_name || "",
      role: data.user.role,
    };
    setUser(u);
    setRole(u.role as AppRole);
  };

  const signUp = async (email: string, password: string, fullName: string, selectedRole: AppRole) => {
    const res = await fetch(`${API_BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: fullName, role: selectedRole }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || "Signup failed");

    const token = data.access_token;
    sessionStorage.setItem("auth_token", token);
    apiClient.setToken(token);
    setSession({ access_token: token });

    const u: AuthUser = {
      id: data.user.id,
      email: data.user.email,
      name: data.user.name || data.user.full_name || "",
      role: data.user.role,
    };
    setUser(u);
    setRole(u.role as AppRole);
  };

  const signOut = async () => {
    sessionStorage.removeItem("auth_token");
    apiClient.clearToken();
    setSession(null);
    setUser(null);
    setRole(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, role, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
