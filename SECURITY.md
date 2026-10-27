# Security Policy

## Reporting a vulnerability

Please **do not** open a public issue, pull request, or discussion for a suspected vulnerability.

Email **[contact@mentormates.ai](mailto:contact@mentormates.ai)** with the subject line `Security report`. Include:

- A description of the issue and its potential impact.
- Steps to reproduce, or a minimal proof of concept.
- The affected route, file, or component, if known.

Do not include real user data, credentials, or tokens in your report. If you accidentally obtained any, tell us and delete your copy.

We aim to acknowledge reports within 5 business days and will keep you informed as we investigate and fix the issue. This is a small volunteer-maintained project, not a dedicated security response service, so timelines may vary.

## Scope

In scope:

- This repository's application code, API routes, database migrations, and row-level security policies.
- Authentication, authorization, and role (participant, mentor, judge, organizer, admin) boundaries.

Out of scope:

- Third-party services MentorMates integrates with (Supabase, Stream, Stripe, Resend, OpenAI, and others). Report those to the respective vendor.
- Denial-of-service, spam, or social-engineering attacks.
- Findings that require a compromised device or browser.

## Safe harbor

We will not pursue action against researchers who act in good faith: avoid privacy violations and service disruption, test only against accounts you own, and give us reasonable time to fix an issue before disclosing it.

## Supported versions

Only the latest `main` branch is supported. There are no maintained release branches.
