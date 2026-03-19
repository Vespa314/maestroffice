import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/types';

export function useUsers(enabled: boolean = true) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUserOnDuty = useCallback(async (username: string, isOnDuty: boolean) => {
    await api.updateUserOnDuty(username, isOnDuty);
    setUsers((prev) =>
      prev.map((u) => (u.username === username ? { ...u, is_on_duty: isOnDuty } : u))
    );
  }, []);

  const createUser = useCallback(async (companyName: string, username: string) => {
    await api.createUser(companyName, username);
    await fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    if (enabled) {
      fetchUsers();
    }
  }, [fetchUsers, enabled]);

  return { users, loading, error, fetchUsers, updateUserOnDuty, createUser };
}
