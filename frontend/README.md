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

This React frontend now includes a Google OAuth login flow for ALRM using `@react-oauth/google` and `react-router-dom`.

Implemented changes:

- Added global authentication state through `AuthContext`.
- Added Google Sign-In on the `/login` page.
- Decoded the Google credential response to read the signed-in user's email.
- Restricted access to emails under the `laverdad.edu.ph` domain, including subdomains such as `student.laverdad.edu.ph`.
- Displays an explicit access restriction alert when a user signs in with a non-La Verdad account.
- Added `/login` and `/dashboard` routes.
- Added `ProtectedRoute` route guarding:
  - Unauthenticated users are redirected from `/dashboard` to `/login`.
  - Authenticated users are redirected from `/login` to `/dashboard`.
- Added a placeholder dashboard that shows the authenticated user's email and a logout button.

## Available Scripts

```bash
npm install
npm run dev
npm run build
npm run preview
npm run lint
```

## Important Scope Notes

This implementation does not include role-based access control or role validation. It only handles Google OAuth sign-in, La Verdad email-domain validation, global auth state, route protection, and login/dashboard redirection.
