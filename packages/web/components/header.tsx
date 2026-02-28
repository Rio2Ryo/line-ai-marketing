"use client";
import { useRouter } from "next/navigation";
import { removeToken } from "@/lib/auth";

export default function Header({ title }: { title: string }) {
  const router = useRouter();

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="flex items-center gap-4">
        <div className="w-8 h-8 bg-[#06C755]/10 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-[#06C755]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ログアウト
        </button>
      </div>
    </header>
  );
}
