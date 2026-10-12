# Project Invitation Security

## Overview

Project invitations now use email-based hash verification to ensure that only the invited user can accept the invitation. This prevents unauthorized users from joining projects even if they obtain the invitation link.

## How It Works

### 1. Hash Generation
When a project invitation is sent via `/api/projects/invite-teammate`:
- A secure hash is generated based on:
  - Project ID
  - Invitee's email (normalized to lowercase)
  - Secret key (from `INVITE_HASH_SECRET` env var or falls back to `NEXT_PUBLIC_SUPABASE_URL`)
- The hash is included in the invitation email link

### 2. Hash Verification
When a user attempts to join via `/join-project?project={id}&hash={hash}`:
- The system retrieves the signed-in user's email
- Generates the expected hash using the same algorithm
- Compares the provided hash with the expected hash
- Only allows joining if the hashes match

### 3. Security Benefits
- **Email-specific**: Each invitation link is tied to a specific email address
- **Non-transferable**: Users cannot share invitation links with others
- **Tamper-proof**: Hash cannot be forged without the secret key
- **Privacy-preserving**: Email is not exposed in the URL, only the hash

## Implementation Files

### Core Utilities
- `lib/utils/invite-links.ts`: Hash generation and validation functions
  - `generateEmailInviteHash(projectId, email)`: Creates secure hash
  - `validateEmailInviteHash(projectId, email, hash)`: Verifies hash

### API Route
- `app/api/projects/invite-teammate/route.ts`: Generates hash when sending invitations

### Email Template
- `lib/email_templates/project-invitation.ts`: Includes hash in invitation URL

### Join Page
- `app/join-project/page.tsx`: Validates hash before allowing user to join

## Configuration

### Optional Environment Variable
For enhanced security, you can set a custom secret key:

```bash
# Generate a secure random key
openssl rand -hex 32

# Add to .env.local
INVITE_HASH_SECRET=your-generated-secret-key-here
```

If not set, the system falls back to using `NEXT_PUBLIC_SUPABASE_URL` as the secret.

## Error Messages

Users will see helpful error messages if:
- No hash is provided: "Invalid invitation link. Please use the link from your invitation email."
- Hash doesn't match: "This invitation link was sent to a different email address. Please sign in with the invited email or contact the project lead."

## Testing

To test the implementation:

1. **Valid Invitation**:
   - Invite a user to a project
   - Sign in with the invited email
   - Click the invitation link
   - Should successfully join the project

2. **Invalid Hash**:
   - Get an invitation link
   - Sign in with a different email
   - Try to use the invitation link
   - Should see error message

3. **Missing Hash**:
   - Try to access `/join-project?project={id}` without hash parameter
   - Should see error message

## Migration Notes

- Existing invitation flows should be updated to use the hash parameter
- Old invitation links without hashes will be rejected
- All new invitations automatically include the hash

