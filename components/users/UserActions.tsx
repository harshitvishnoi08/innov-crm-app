'use client';

import { useState } from 'react';
import { EllipsisVertical, Pencil, Trash2 } from 'lucide-react';
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useUpdateUserMutation,
} from '@/queries/users';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ConfirmAlert } from '@/components/common/ConfirmAlert';

type UserData = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: 'ADMIN' | 'USER';
};

type UserActionsProps =
  | { mode: 'create' }
  | { mode: 'row'; user: UserData };

/**
 * Single reusable dialog that handles create, edit, and delete user actions.
 * Keeps all user action UI/behavior centralized to avoid duplicated logic.
 */
export function UserActions(props: UserActionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [name, setName] = useState(props.mode === 'row' ? props.user.name : '');
  const [email, setEmail] = useState(props.mode === 'row' ? props.user.email : '');
  const [phone, setPhone] = useState(props.mode === 'row' ? props.user.phone ?? '' : '');
  const [role, setRole] = useState<'ADMIN' | 'USER'>(props.mode === 'row' ? props.user.role : 'USER');

  const createMutation = useCreateUserMutation();
  const updateMutation = useUpdateUserMutation();
  const deleteMutation = useDeleteUserMutation();
  const isSubmitting =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      if (props.mode === 'create') {
        await createMutation.mutateAsync({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          role,
        });
      } else {
        await updateMutation.mutateAsync({
          id: props.user.id,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          role,
        });
      }
      setIsOpen(false);
    } catch {}
  }

  const isCreate = props.mode === 'create';
  const isRowActions = props.mode === 'row';

  async function handleDeleteConfirm() {
    if (!isRowActions) return;

    try {
      await deleteMutation.mutateAsync({ id: props.user.id });
      setIsDeleteAlertOpen(false);
    } catch {}
  }

  return (
    <>
      {isCreate ? (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={isSubmitting}>
              Add user
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add user</DialogTitle>
              <DialogDescription>
                An invite email will be sent. The user sets their own password when they accept.
              </DialogDescription>
            </DialogHeader>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="user-action-name">Name</Label>
                <Input
                  id="user-action-name"
                  placeholder="John Doe"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-action-email">Email</Label>
                <Input
                  id="user-action-email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="user-action-phone">WhatsApp number</Label>
                <Input
                  id="user-action-phone"
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  disabled={isSubmitting}
                />
                <p className="text-xs text-muted-foreground">
                  Used for meeting reminders on WhatsApp. Indian numbers can be 10 digits.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as 'ADMIN' | 'USER')}
                  disabled={isSubmitting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">User</SelectItem>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={isSubmitting || !name.trim() || !email.trim()}>
                  {isSubmitting ? 'Sending invite…' : 'Send invite'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="User actions">
                <EllipsisVertical className="size-4" />
                <span className="sr-only">User actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  if (isRowActions) {
                    setName(props.user.name);
                    setEmail(props.user.email);
                    setPhone(props.user.phone ?? '');
                    setRole(props.user.role);
                  }
                  setIsOpen(true);
                }}
              >
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  setIsDeleteAlertOpen(true);
                }}
              >
                <Trash2 className="size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Dialog
            open={isOpen}
            onOpenChange={(open) => {
              setIsOpen(open);
              if (open && isRowActions) {
                setName(props.user.name);
                setEmail(props.user.email);
                setPhone(props.user.phone ?? '');
                setRole(props.user.role);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit user</DialogTitle>
                <DialogDescription>Update name and email for this user.</DialogDescription>
              </DialogHeader>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="user-action-name">Name</Label>
                  <Input
                    id="user-action-name"
                    placeholder="John Doe"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-action-email">Email</Label>
                  <Input
                    id="user-action-email"
                    type="email"
                    placeholder="john@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="user-action-phone">WhatsApp number</Label>
                  <Input
                    id="user-action-phone"
                    type="tel"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Used for meeting reminders on WhatsApp. Indian numbers can be 10 digits.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={role}
                    onValueChange={(value) => setRole(value as 'ADMIN' | 'USER')}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">User</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DialogFooter>
                  <Button type="submit" disabled={isSubmitting || !name.trim() || !email.trim()}>
                    {isSubmitting ? 'Saving...' : 'Save changes'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      )}

      {isRowActions ? (
        <ConfirmAlert
          open={isDeleteAlertOpen}
          onOpenChange={setIsDeleteAlertOpen}
          title="Confirm delete"
          description="Are you sure you want to delete this user? This action cannot be undone."
          confirmText={isSubmitting ? 'Deleting...' : 'Delete user'}
          isLoading={isSubmitting}
          onConfirm={handleDeleteConfirm}
        />
      ) : null}
    </>
  );
}
