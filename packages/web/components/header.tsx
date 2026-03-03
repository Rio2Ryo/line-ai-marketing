"use client";
import { useRouter } from "next/navigation";
import { removeToken } from "@/lib/auth";
import { useTranslation, Locale } from '@/lib/i18n';
import { useRole } from '@/lib/role';

interface HeaderProps {
  title: string;
  onMenuToggle: () => void;
}

export default function Header({ title, onMenuToggle }: HeaderProps) {
  const router = useRouter();
  const { t, locale, setLocale } = useTranslation();
  const { role } = useRole();

  const handleLogout = () => {
    removeToken();
    router.push("/login");
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8">
      <div className="flex items-center gap-3">
        {/* Hamburger menu - mobile only */}
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <h2 className="text-lg md:text-xl font-semibold text-gray-900">{title}</h2>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setLocale('ja')}
            className={`px-2 py-1 text-xs font-medium transition-colors ${
              locale === 'ja' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            JA
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`px-2 py-1 text-xs font-medium transition-colors ${
              locale === 'en' ? 'bg-gray-800 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            EN
          </button>
        </div>
        {/* Role badge */}
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
          role === 'admin' ? 'bg-purple-100 text-purple-800' :
          role === 'operator' ? 'bg-blue-100 text-blue-800' :
          'bg-gray-100 text-gray-600'
        }`}>
          {role === 'admin' ? (locale === 'ja' ? '管理者' : 'Admin') :
           role === 'operator' ? (locale === 'ja' ? 'オペレーター' : 'Operator') :
           locale === 'ja' ? '閲覧者' : 'Viewer'}
        </span>
        <div className="w-8 h-8 bg-[#06C755]/10 rounded-full flex items-center justify-center">
          <svg className="w-5 h-5 text-[#06C755]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <button onClick={handleLogout} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          {t('header.logout')}
        </button>
      </div>
    </header>
  );
}
