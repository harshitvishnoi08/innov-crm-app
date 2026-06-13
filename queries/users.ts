import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, deleteUser, fetchUsers, updateUser } from '@/services/users.service';
import { toast } from 'sonner';

export const usersQueryKeys = {
  all: ['users'],
};

export function useUsersQuery(options = {}) {
  return useQuery({
    queryKey: usersQueryKeys.all,
    queryFn: fetchUsers,
    staleTime: 1000 * 30,
    ...options,
  });
}

export function useCreateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; email: string; phone?: string; role: 'ADMIN' | 'USER' }) =>
      createUser(payload),
    onSuccess: async () => {
      toast.success('Invite sent! The user will receive an email to set their password.');
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Could not create user.';
      toast.error(message);
    },
  });
}

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { id: string; name: string; email: string; phone?: string; role?: 'ADMIN' | 'USER' }) =>
      updateUser(payload),
    onSuccess: async () => {
      toast.success('User updated successfully.');
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Could not update user.';
      toast.error(message);
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { id: string }) => deleteUser(payload),
    onSuccess: async () => {
      toast.success('User deleted successfully.');
      await queryClient.invalidateQueries({ queryKey: usersQueryKeys.all });
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : 'Could not delete user.';
      toast.error(message);
    },
  });
}
