import { handleGateway } from '../server/authGateway.js';
import process from 'node:process';

// Vercel runs this file on the server. Nothing here is bundled for the browser.
export default {
  fetch(request) {
    return handleGateway(request, {
      secret: process.env.ALRM_COOKIE_SECRET,
      backendOrigin: process.env.ALRM_BACKEND_ORIGIN || 'https://absenteeism-late-report-and-excuse.onrender.com',
      production: true,
      // Vercel supplies this metadata; never trust a caller's ordinary X-Forwarded-For.
      clientIp: request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim(),
    });
  },
};
