import { useEffect, useState, useCallback } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { EmployeeTarget } from '../types';
import type { User } from '../types';

function sortTargets(list: EmployeeTarget[]): EmployeeTarget[] {
  return [...list].sort((a, b) => {
    const statusOrder = (s: string) => (s === 'Active' ? 0 : s === 'Overdue' ? 1 : s === 'Completed' ? 2 : 3);
    const diff = statusOrder(a.status) - statusOrder(b.status);
    if (diff !== 0) return diff;
    return (a.endDate || '').localeCompare(b.endDate || '');
  });
}

function docToTarget(id: string, data: Record<string, unknown>): EmployeeTarget {
  return { id, ...data } as EmployeeTarget;
}

/** Subscribe to targets assigned to this employee (userId + employeeId, no composite index needed). */
export function useEmployeeTargets(user: User | null) {
  const [targets, setTargets] = useState<EmployeeTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mergeAndSet = useCallback((byUserId: EmployeeTarget[], byEmpId: EmployeeTarget[]) => {
    const map = new Map<string, EmployeeTarget>();
    [...byUserId, ...byEmpId].forEach(t => map.set(t.id, t));
    setTargets(sortTargets(Array.from(map.values())));
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let byUserId: EmployeeTarget[] = [];
    let byEmpId: EmployeeTarget[] = [];
    let uidReady = false;
    let empReady = !user.employeeId;

    const tryMerge = () => {
      if (uidReady && empReady) mergeAndSet(byUserId, byEmpId);
    };

    const qUser = query(collection(db, 'targets'), where('userId', '==', user.id));
    const unsubUser = onSnapshot(
      qUser,
      snap => {
        byUserId = snap.docs.map(d => docToTarget(d.id, d.data()));
        uidReady = true;
        setError(null);
        tryMerge();
      },
      err => {
        console.warn('[Targets] userId query error:', err?.message);
        uidReady = true;
        tryMerge();
      },
    );

    let unsubEmp = () => {};
    const empVariants = [
      ...new Set(
        [(user.employeeId || '').trim(), (user.employeeId || '').trim().toUpperCase(), (user.employeeId || '').trim().toLowerCase()].filter(Boolean),
      ),
    ];
    if (empVariants.length > 0) {
      const qEmp =
        empVariants.length === 1
          ? query(collection(db, 'targets'), where('employeeId', '==', empVariants[0]))
          : query(collection(db, 'targets'), where('employeeId', 'in', empVariants.slice(0, 10)));
      unsubEmp = onSnapshot(
        qEmp,
        snap => {
          byEmpId = snap.docs.map(d => docToTarget(d.id, d.data()));
          empReady = true;
          setError(null);
          tryMerge();
        },
        err => {
          console.warn('[Targets] employeeId query error:', err?.message);
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

  return { targets, loading, error };
}
