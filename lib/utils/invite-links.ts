import { createHash } from 'crypto';

export function generateProjectInviteHash(projectId: string): string {
  const hash = createHash('sha256')
    .update(projectId + process.env.NEXT_PUBLIC_SUPABASE_URL!)
    .digest('hex')
    .slice(0, 16);
  
  return hash;
}

export function generateProjectInviteLink(projectId: string): string {
  const hash = generateProjectInviteHash(projectId);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/join-project/${projectId}/${hash}`;
}

export function validateProjectInviteHash(projectId: string, hash: string): boolean {
  const expectedHash = generateProjectInviteHash(projectId);
  return hash === expectedHash;
}

/**
 * Generates a secure hash for a project invitation based on the invitee's email
 * This ensures only the invited user can accept the invitation
 */
export function generateEmailInviteHash(projectId: string, email: string): string {
  const secret = process.env.INVITE_HASH_SECRET;
  const normalizedEmail = email.trim().toLowerCase();
  
  const hash = createHash('sha256')
    .update(`${projectId}:${normalizedEmail}:${secret}`)
    .digest('hex')
    .slice(0, 32); // Use 32 characters for better security
  
  return hash;
}

/**
 * Validates that the hash matches the expected hash for the given project and email
 */
export function validateEmailInviteHash(projectId: string, email: string, hash: string): boolean {
  const expectedHash = generateEmailInviteHash(projectId, email);
  return hash === expectedHash;
}