'use client';

import { CalendarDays, Shield, Users, UserX } from 'lucide-react';
import { useUsersQuery } from '@/queries/users';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { UserActions } from '@/components/users/UserActions';

type UserListItem = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  createdAt: string;
};

function formatIndiaDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function UsersSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-72 w-full" />
    </div>
  );
}

export function UsersOverview() {
  const { data, isLoading, isError, error, refetch } = useUsersQuery();

  const users = (data ?? []) as UserListItem[];

  if (isLoading) return <UsersSkeleton />;

  if (isError) {
    return (
      <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
        <p className="text-sm text-red-500">
          {error instanceof Error
            ? error.message
            : 'Something went wrong while loading users.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <Card className="border-primary/20 bg-linear-to-br from-primary/5 via-background to-background">
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              <span className="rounded-md bg-primary/10 p-1.5 text-primary">
                <Users className="h-4 w-4" />
              </span>
              All users
            </CardTitle>
            <div className="flex items-center gap-2">
              <UserActions mode="create" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {users.length === 0 ? (
            <div className="mx-6 mb-6 flex items-center gap-2 rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
              <UserX className="h-4 w-4 text-muted-foreground" />
              No users found yet.
            </div>
          ) : (
            <>
              {/* ── Mobile card list (hidden md+) ── */}
              <div className="divide-y md:hidden">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center gap-3 px-4 py-3">
                    {/* Avatar initials */}
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium leading-tight">{user.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge variant="secondary" className="inline-flex items-center gap-1 py-0 text-[10px]">
                          <Shield className="h-3 w-3" />
                          {user.role}
                        </Badge>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <CalendarDays className="h-3 w-3" />
                          {formatIndiaDate(user.createdAt)}
                        </span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="shrink-0">
                      <UserActions mode="row" user={{ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role as 'ADMIN' | 'USER' }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Desktop table (hidden below md) ── */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-6">Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-right">Created</TableHead>
                      <TableHead className="pr-6 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="pl-6 font-medium">{user.name}</TableCell>
                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="inline-flex items-center gap-1">
                            <Shield className="h-3.5 w-3.5" />
                            {user.role}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatIndiaDate(user.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell className="pr-6">
                          <div className="flex items-center justify-end gap-1">
                            <UserActions mode="row" user={{ id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role as 'ADMIN' | 'USER' }} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
