# ALRM Frontend Documentation

This folder contains the React + Vite frontend for the ALRM System. The project uses JavaScript/JSX, Tailwind CSS, ShadCN UI components, React Router, and the existing backend API.

## Frontend Dependency Setup

Follow these steps from the project root to install and run the frontend locally.

### 1. Prerequisites

Install Node.js and npm before setting up the frontend. Use a current Node.js LTS version when possible.

Check that both tools are available:

```bash
node --version
npm --version
```

### 2. Open the Frontend Folder

```bash
cd frontend
```

### 3. Configure Environment Variables

Create or update the frontend `.env` file.

```env
VITE_API_URL=http://127.0.0.1:8000
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

Use the backend URL that matches your local backend server. If your backend is running on a different host or port, update `VITE_API_URL` accordingly.

### 4. Install Dependencies

Use npm because this frontend already uses npm package scripts.

```bash
npm install
```

This installs the React, Vite, Tailwind CSS, ShadCN UI, routing, icon, chart, date, and Google OAuth dependencies listed in `package.json`.

### 5. Start the Development Server

```bash
npm run dev
```

Vite will print a local development URL in the terminal, usually:

```bash
http://localhost:5173
```

Open that URL in your browser to use the frontend.

### 6. Build for Production

```bash
npm run build
```

The production build is generated in the `dist` folder.

### 7. Preview the Production Build

```bash
npm run preview
```

Use this after `npm run build` to test the built frontend locally.

### 8. Run Linting

```bash
npm run lint
```

Run this before submitting frontend changes to catch JavaScript and React issues.

## Setup Troubleshooting

If dependencies fail to install, confirm that Node.js and npm are installed correctly, then run `npm install` again inside the `frontend` folder.

If the frontend cannot connect to the backend, check that:

- The backend server is running.
- `VITE_API_URL` points to the correct backend URL.
- The backend allows requests from the Vite development URL.

If Google login does not load, check that:

- `VITE_GOOGLE_CLIENT_ID` exists in the frontend `.env` file.
- The Google OAuth client is configured for the local frontend URL.

## Authentication Flow

Google sign-in uses the existing backend OAuth redirect. The backend validates
the school email and issues an OTP challenge when required. After successful
verification, the frontend exchanges the one-time code for a backend session
token and validates it with `GET /api/me`.

- `AuthContext` restores the authenticated user from the saved token.
- `ProtectedRoute` applies authentication, profile-completion, and role checks.
- Login and OTP pages resume an existing server-validated session.
- Role and verification permissions come from the backend, not local trust flags.
- Logout revokes the current backend token and clears the browser session.

## Available Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
npm run test:session
```

## Session Persistence Across Deployments

The frontend reuses the existing backend-issued Sanctum token in `localStorage`
under `auth_token`. A new frontend build does not create a new login or OTP
challenge. On startup, `GET /api/me` validates the saved token before protected
pages are displayed. Local verification flags do not grant access.

The current URL stays intact on reload. The last authorized page is also saved
per account, so opening `/` or `/login` with a valid session returns to that page.
Existing profile-completion and role guards still apply. This restores the page,
not unsaved form contents.

If the API is temporarily offline or restarting, the frontend keeps the token
and current URL and shows a retry action. A `401` response for the current token
ends that session. Explicit logout clears the token in all open tabs and calls
the existing backend logout endpoint.

Deployment requirements:

- Use the same production origin. Browser storage is separate for localhost,
  production domains, and Vercel preview URLs.
- Keep `VITE_API_URL` pointed at the same backend and persistent token database.
- Keep the existing Vercel SPA rewrite so direct page reloads load `index.html`.
- Do not reset the token database during deployment. The frontend cannot restore
  tokens that the backend has revoked or deleted, or browser storage the user cleared.
- The inspected backend requires OTP for a fresh Google login and revokes older
  tokens after successful OTP verification. Those backend policies are unchanged.

Run `npm run test:session` for dependency-free session and page-restoration
regression tests. Browser verification should also cover reloading a protected
page, opening a new tab, a temporary API outage, OTP completion, and logout.

## Important Scope Notes

Session recovery does not create a separate authentication system or change
backend OTP, token-expiration, or role-assignment policies. API authorization
continues to be enforced by the existing backend. A lost or revoked backend
token requires a new login; a frontend-generated flag cannot replace it.
