export async function fetchUsers() {
  const response = await fetch('/api/users', {
    method: 'GET',
  });

  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error ?? 'Failed to fetch users');
  }

  return json?.data?.users ?? [];
}

export async function createUser(payload: {
  name: string;
  email: string;
  phone?: string;
  role: 'ADMIN' | 'USER';
}) {
  const normalizedPayload = {
    ...payload,
    email: payload.email.trim().toLowerCase(),
  };
  const response = await fetch('/api/users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalizedPayload),
  });

  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error ?? 'Failed to create user');
  }

  return json?.data;
}

export async function updateUser(payload: { id: string; name: string; email: string; phone?: string; role?: 'ADMIN' | 'USER' }) {
  const normalizedPayload = {
    ...payload,
    email: payload.email.trim().toLowerCase(),
  };

  const response = await fetch('/api/users', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalizedPayload),
  });

  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error ?? 'Failed to update user');
  }

  return json?.data;
}

export async function deleteUser(payload: { id: string }) {
  const response = await fetch('/api/users', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const json = await response.json();
  if (!response.ok || !json?.success) {
    throw new Error(json?.error ?? 'Failed to delete user');
  }

  return json?.data;
}
