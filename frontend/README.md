# Frontend Documentation

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

## Environment Setup

Create or update the frontend `.env` file with your Google OAuth client ID:

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
```

The existing `VITE_API_URL` value can remain in the same `.env` file.

## Available Scripts

```bash
npm install
npm run dev
npm run build
```

## Important Scope Notes

This implementation does not include role-based access control or role validation. It only handles Google OAuth sign-in, La Verdad email-domain validation, global auth state, route protection, and login/dashboard redirection.
