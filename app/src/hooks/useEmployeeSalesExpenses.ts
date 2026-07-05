import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { User } from '../types';

export interface SalesEntry {
  id: string;
  type: 'sale' | 'expense';
  title: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
  employeeId?: string;
  userId?: string;
  employeeName?: string;
  branch?: string;
  branchId?: string;
  department?: string;
  createdAt?: unknown;
}

function sortByDateDesc(list: SalesEntry[]): SalesEntry[] {
  return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

function docToEntry(id: string, data: Record<string, unknown>): SalesEntry {
  return { id, ...data, amount: Number(data.amount) || 0 } as SalesEntry;
}

/** Subscribe to sales/expenses for the logged-in employee (userId + employeeId, no composite index). */
export function useEmployeeSalesExpenses(user: User | null) {
  const [entries, setEntries] = useState<SalesEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mergeAndSet = useCallback((byUserId: SalesEntry[], byEmpId: SalesEntry[]) => {
    const map = new Map<string, SalesEntry>();
    [...byUserId, ...byEmpId].forEach(e => map.set(e.id, e));
    setEntries(sortByDateDesc(Array.from(map.values())));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let byUserId: SalesEntry[] = [];
    let byEmpId: SalesEntry[] = [];
    let uidReady = false;
    const empVariants = [
      ...new Set(
        [(user.employeeId || '').trim(), (user.employeeId || '').trim().toUpperCase(), (user.employeeId || '').trim().toLowerCase()].filter(Boolean),
      ),
    ];
    let empReady = empVariants.length === 0;

    const tryMerge = () => {
      if (uidReady && empReady) mergeAndSet(byUserId, byEmpId);
    };

    const qUser = query(collection(db, 'salesExpenses'), where('userId', '==', user.id));
    const unsubUser = onSnapshot(
      qUser,
      snap => {
        byUserId = snap.docs.map(d => docToEntry(d.id, d.data()));
        uidReady = true;
        setError(null);
        tryMerge();
      },
      err => {
        console.warn('[Sales] userId query error:', err?.message);
        uidReady = true;
        tryMerge();
      },
    );

    let unsubEmp = () => {};
    if (empVariants.length > 0) {
      const qEmp =
        empVariants.length === 1
          ? query(collection(db, 'salesExpenses'), where('employeeId', '==', empVariants[0]))
          : query(collection(db, 'salesExpenses'), where('employeeId', 'in', empVariants.slice(0, 10)));
      unsubEmp = onSnapshot(
        qEmp,
        snap => {
          byEmpId = snap.docs.map(d => docToEntry(d.id, d.data()));
          empReady = true;
          setError(null);
          tryMerge();
        },
        err => {
          console.warn('[Sales] employeeId query error:', err?.message);
          empReady = true;
          tryMerge();
        },
      );
    }

    return () => {
      unsubUser();
      unsubEmp();
    };
  }, [user?.id, user?.employeeId, mergeAndSet]);

  return { entries, loading, error };
}
