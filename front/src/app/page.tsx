"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/control/AuthContext";
import LoginForm from "@/view/LoginForm";

export default function HomePage() {
  const { isAuthenticated, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated && user) {
      const routes: Record<string, string> = {
        aluno: "/aluno",
        professor: "/professor",
        coacessi: "/coacessi",
      };
      router.push(routes[user.role] || "/");
    }
  }, [isAuthenticated, user, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <svg className="animate-spin h-8 w-8 text-emerald-700" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (isAuthenticated) return null;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-4rem)] px-4">
      <LoginForm />
    </div>
  );
}
