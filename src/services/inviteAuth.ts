import { Models, Query } from 'appwrite';
import { appEnv, assertAppwriteEnv } from '@/config/env';
import { appwriteAccount, appwriteDatabases } from '@/lib/appwrite';

const AUTH_STORAGE_KEY = 'tenderspot_invite_hash';

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function ensureAnonymousSession(): Promise<void> {
  try {
    await appwriteAccount.get();
    return;
  } catch {
    await appwriteAccount.createAnonymousSession();
  }
}

async function findInviteByHash(tokenHash: string): Promise<Models.Document | null> {
  const response = await appwriteDatabases.listDocuments(
    appEnv.databaseId!,
    appEnv.inviteTokensCollectionId!,
    [Query.equal('tokenHash', tokenHash), Query.equal('isActive', true), Query.limit(1)]
  );

  if (response.total === 0) {
    return null;
  }

  const invite = response.documents[0];
  if (invite.expiresAt) {
    const expiresAt = new Date(invite.expiresAt as string);
    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() < Date.now()) {
      return null;
    }
  }

  return invite;
}

export async function loginWithInviteToken(rawToken: string): Promise<void> {
  assertAppwriteEnv();

  const token = rawToken.trim();
  if (!token) {
    throw new Error('Введите invite-токен.');
  }

  await ensureAnonymousSession();

  const tokenHash = await sha256Hex(token);
  const invite = await findInviteByHash(tokenHash);
  if (!invite) {
    throw new Error('Invite-токен не найден или деактивирован.');
  }

  localStorage.setItem(AUTH_STORAGE_KEY, tokenHash);
}

export async function restoreInviteSession(): Promise<boolean> {
  assertAppwriteEnv();

  const tokenHash = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!tokenHash) {
    return false;
  }

  try {
    await ensureAnonymousSession();
    const invite = await findInviteByHash(tokenHash);
    if (!invite) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return false;
    }
    return true;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return false;
  }
}

export async function logoutInviteSession(): Promise<void> {
  localStorage.removeItem(AUTH_STORAGE_KEY);

  try {
    await appwriteAccount.deleteSession('current');
  } catch {
    // No active session.
  }
}
