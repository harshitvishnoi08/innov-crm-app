import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireAuth, adminClient } from '@/lib/api-auth';

// Optional phone — accepts digits, +, -, spaces, parentheses; empty string allowed (means "clear it").
const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\-\s()]{7,20}$/, 'Please provide a valid phone number.')
  .optional()
  .or(z.literal(''));

const createUserSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.email('Please provide a valid email address.').transform((v) => v.trim().toLowerCase()),
  phone: phoneSchema,
  role: z.enum(['ADMIN', 'USER']).default('USER'),
});

const updateUserSchema = z.object({
  id: z.string().trim().uuid('Invalid user id.'),
  name: z.string().trim().min(1, 'Name is required.'),
  email: z.email('Please provide a valid email address.').transform((v) => v.trim().toLowerCase()),
  phone: phoneSchema,
  role: z.enum(['ADMIN', 'USER']).optional(),
});

const deleteUserSchema = z.object({
  id: z.string().trim().uuid('Invalid user id.'),
});

async function requireAdmin() {
  const { user, response } = await requireAuth();
  if (!user) return { ok: false as const, response: response! };

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, rolePermission: { select: { role: true } } },
  });

  if (!dbUser || dbUser.rolePermission.role !== 'ADMIN') {
    return {
      ok: false as const,
      response: NextResponse.json({ success: false, error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 }),
    };
  }

  return { ok: true as const, userId: dbUser.id };
}

export async function GET() {
  try {
    const check = await requireAdmin();
    if (!check.ok) return check.response;

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, email: true, phone: true, createdAt: true,
        rolePermission: { select: { role: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        users: users.map((u: { id: string; name: string; email: string; phone: string | null; createdAt: Date; rolePermission: { role: string } }) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, createdAt: u.createdAt, role: u.rolePermission.role })),
      },
    });
  } catch (error) {
    console.error({ fn: 'GET /api/users', error });
    return NextResponse.json({ success: false, error: 'Could not load users.', code: 'USERS_FETCH_FAILED' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const check = await requireAdmin();
    if (!check.ok) return check.response;

    const parsed = createUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payload.', code: 'INVALID_USER_PAYLOAD' }, { status: 400 });
    }

    const { name, email, role } = parsed.data;
    const phone = parsed.data.phone?.trim() || null;

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) {
      return NextResponse.json({ success: false, error: 'A user with this email already exists.', code: 'USER_EXISTS' }, { status: 409 });
    }

    const rolePermission = await prisma.rolePermission.findFirst({ where: { role }, select: { id: true } });
    if (!rolePermission) {
      return NextResponse.json({ success: false, error: `${role} role is not configured.`, code: 'ROLE_NOT_CONFIGURED' }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Send invite email via Supabase — user sets their own password.
    // The invite email template uses the token_hash/verifyOtp flow and points to
    // /auth/confirm (see app/auth/confirm/route.ts). redirectTo is only used as a
    // fallback ({{ .RedirectTo }}) for the legacy code flow.
    const admin = adminClient();
    const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl}/auth/confirm?next=/auth/reset-password`,
      data: { name },
    });

    if (authError || !authData.user) {
      console.error('Supabase invite error:', authError);
      return NextResponse.json({ success: false, error: 'Could not send invite email.', code: 'INVITE_FAILED' }, { status: 500 });
    }

    // Create profile in public.users with the same UUID from Supabase Auth
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        name,
        email,
        phone,
        emailVerified: false,
        rolePermissionId: rolePermission.id,
      },
      select: { id: true, name: true, email: true, phone: true, createdAt: true },
    });

    return NextResponse.json({ success: true, data: { user: { ...user, role } } }, { status: 201 });
  } catch (error) {
    console.error({ fn: 'POST /api/users', error });
    return NextResponse.json({ success: false, error: 'Could not create user.', code: 'USER_CREATE_FAILED' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const check = await requireAdmin();
    if (!check.ok) return check.response;

    const parsed = updateUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payload.', code: 'INVALID_UPDATE_PAYLOAD' }, { status: 400 });
    }

    const { id, name, email, role } = parsed.data;
    const phone = parsed.data.phone?.trim() || null;

    const user = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!user) return NextResponse.json({ success: false, error: 'User not found.', code: 'USER_NOT_FOUND' }, { status: 404 });

    const conflict = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (conflict && conflict.id !== id) {
      return NextResponse.json({ success: false, error: 'Email already in use.', code: 'USER_EXISTS' }, { status: 409 });
    }

    // Resolve rolePermissionId if role is being changed
    let rolePermissionId: string | undefined;
    if (role) {
      const rolePermission = await prisma.rolePermission.findFirst({ where: { role }, select: { id: true } });
      if (!rolePermission) {
        return NextResponse.json({ success: false, error: `${role} role is not configured.`, code: 'ROLE_NOT_CONFIGURED' }, { status: 500 });
      }
      rolePermissionId = rolePermission.id;
    }

    // Update email in Supabase Auth too
    const admin = adminClient();
    await admin.auth.admin.updateUserById(id, { email });

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { name, email, phone, ...(rolePermissionId && { rolePermissionId }) },
      select: { id: true, name: true, email: true, phone: true, createdAt: true, rolePermission: { select: { role: true } } },
    });

    return NextResponse.json({ success: true, data: { user: { ...updatedUser, role: updatedUser.rolePermission.role } } });
  } catch (error) {
    console.error({ fn: 'PATCH /api/users', error });
    return NextResponse.json({ success: false, error: 'Could not update user.', code: 'USER_UPDATE_FAILED' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const check = await requireAdmin();
    if (!check.ok) return check.response;

    const parsed = deleteUserSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ success: false, error: parsed.error.issues[0]?.message ?? 'Invalid payload.', code: 'INVALID_DELETE_PAYLOAD' }, { status: 400 });
    }

    const { id } = parsed.data;

    if (id === check.userId) {
      return NextResponse.json({ success: false, error: 'You cannot delete your own account.', code: 'SELF_DELETE_NOT_ALLOWED' }, { status: 409 });
    }

    const targetUser = await prisma.user.findUnique({ where: { id }, select: { id: true } });
    if (!targetUser) return NextResponse.json({ success: false, error: 'User not found.', code: 'USER_NOT_FOUND' }, { status: 404 });

    // Detach all records so no FK constraint blocks the delete
    await prisma.$transaction([
      prisma.lead.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.lead.updateMany({ where: { assignedTo: id }, data: { assignedTo: null } }),
      prisma.leadActivity.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.comment.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.meeting.updateMany({ where: { userId: id }, data: { userId: null } }),
    ]);

    // Delete from public.users (LeadTeamMember + Chat cascade automatically), then Supabase Auth
    await prisma.user.delete({ where: { id } });
    const admin = adminClient();
    await admin.auth.admin.deleteUser(id);

    return NextResponse.json({ success: true, data: { deletedId: id } });
  } catch (error) {
    console.error({ fn: 'DELETE /api/users', error });
    return NextResponse.json({ success: false, error: 'Could not delete user.', code: 'USER_DELETE_FAILED' }, { status: 500 });
  }
}
