'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface LineAccount {
  id: string;
  name: string;
  channel_id: string | null;
  is_active: number;
  is_default: number;
  member_count?: number;
}

interface AccountContextType {
  accounts: LineAccount[];
  currentAccountId: string;
  currentAccount: LineAccount | null;
  switchAccount: (id: string) => void;
  refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType>({
  accounts: [],
  currentAccountId: 'default',
  currentAccount: null,
  switchAccount: () => {},
  refreshAccounts: async () => {},
});

const API = process.env.NEXT_PUBLIC_API_URL || '';

function authHeaders(): HeadersInit {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<LineAccount[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string>('default');

  const refreshAccounts = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/accounts`, { headers: authHeaders() });
      if (res.ok) {
        const json = await res.json() as { data: LineAccount[] };
        setAccounts(json.data || []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('currentAccountId');
    if (stored) setCurrentAccountId(stored);
    refreshAccounts();
  }, [refreshAccounts]);

  const switchAccount = (id: string) => {
    setCurrentAccountId(id);
    localStorage.setItem('currentAccountId', id);
  };

  const currentAccount = accounts.find(a => a.id === currentAccountId) || accounts.find(a => a.is_default) || null;

  return (
    <AccountContext.Provider value={{ accounts, currentAccountId, currentAccount, switchAccount, refreshAccounts }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
