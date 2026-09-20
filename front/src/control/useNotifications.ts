"use client";

import { useState, useEffect, useCallback } from "react";
import { apiService, Notificacao } from "@/model/api";
import { useAuth } from "@/control/AuthContext";

export function useNotifications() {
  const { isAuthenticated } = useAuth();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotificacoes = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setIsLoading(true);
      const data = await apiService.getNotificacoes();
      setNotificacoes(data);
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotificacoes();
    const interval = setInterval(fetchNotificacoes, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated, fetchNotificacoes]);

  const marcarComoLida = useCallback(async (id: string) => {
    try {
      await apiService.marcarNotificacaoLida(id);
      setNotificacoes((prev) => prev.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    } catch {
      // Silencia erros
    }
  }, []);

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  return { notificacoes, unreadCount, marcarComoLida, isLoading };
}
