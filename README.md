# Alamdar Edu. Inst. Hamray Portal

A browser-based school administration and teacher daily-class-log portal.

## Frontend

- Static HTML, CSS and JavaScript (ES modules).
- Google Identity Services handles sign-in.
- Google Apps Script provides the application API and Google Drive-backed data.
- GitHub Pages hosts the static site.

## Local checks

Requires Node.js 20 or newer.

```sh
npm test
npm run check
```

These tests cover frontend output-safety and date helpers; they do not test the remote Apps Script service.

## Deployment and secrets

GitHub Pages deploys the static site. The API endpoint and OAuth client ID are public client configuration, not secrets. Never commit private keys, refresh tokens, passwords, or service-account credentials.

## Required backend security

The browser is untrusted. Apps Script must verify each Google ID token server-side (signature, issuer, audience and expiry), resolve the active user and role from trusted server-side data, and authorize every action independently. Do not trust role, teacher ID, class ID, or ownership claims supplied by the browser. Restrict admin-only actions and logs, validate all inputs, preserve referential integrity and historical records, and audit sensitive changes.

The Apps Script source is not in this repository, so these backend controls remain unverified. Frontend changes are not a substitute for backend authorization.
