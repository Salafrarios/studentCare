"use client";

import Link from "next/link";
import { useAuth } from "@/control/AuthContext";
import { useRouter } from "next/navigation";

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm h-16">
      <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-emerald-700 hover:text-emerald-600 transition-colors">
          StudentCare
        </Link>

        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <>
              <span className="text-sm text-gray-600 hidden sm:inline">
                {user?.nome}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
              >
                Sair
              </button>
            </>
          ) : (
            <Link
              href="/"
              className="text-sm font-medium text-emerald-700 hover:text-emerald-600 transition-colors"
            >
              Entrar
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
