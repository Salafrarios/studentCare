"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiService, UserData } from "@/model/api";

interface AuthContextType {
  user: UserData | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  isAluno: () => boolean;
  isProfessor: () => boolean;
  isCoacessi: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("studentcare_user");
    const token = apiService.getToken();
    if (stored && token) {
      try {
        setUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem("studentcare_user");
        apiService.clearToken();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiService.login(email, senha);
      setUser(response.user);
      localStorage.setItem("studentcare_user", JSON.stringify(response.user));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login";
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setError(null);
    apiService.clearToken();
    localStorage.removeItem("studentcare_user");
  }, []);

  const clearError = useCallback(() => setError(null), []);
  const isAluno = useCallback(() => user?.role === "aluno", [user]);
  const isProfessor = useCallback(() => user?.role === "professor", [user]);
  const isCoacessi = useCallback(() => user?.role === "coacessi", [user]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, error, login, logout, clearError, isAluno, isProfessor, isCoacessi }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de um AuthProvider");
  }
  return context;
}
