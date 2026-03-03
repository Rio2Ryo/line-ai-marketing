'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { fetchWithAuth, getApiUrl } from '@/lib/auth';

export type Role = 'admin' | 'operator' | 'viewer';

interface RoleContextValue {
  role: Role;
  isAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
  canWrite: boolean;
  loading: boolean;
}

const RoleContext = createContext<RoleContextValue>({
  role: 'viewer',
  isAdmin: false,
  isOperator: false,
  isViewer: true,
  canWrite: false,
  loading: true,
});

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('viewer');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWithAuth(`${getApiUrl()}/auth/me`)
      .then(res => res.json())
      .then((json: any) => {
        if (json.success && json.data?.role) {
          setRole(json.data.role as Role);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const isAdmin = role === 'admin';
  const isOperator = role === 'operator';
  const isViewer = role === 'viewer';
  const canWrite = role === 'admin' || role === 'operator';

  return (
    <RoleContext.Provider value={{ role, isAdmin, isOperator, isViewer, canWrite, loading }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  return useContext(RoleContext);
}
