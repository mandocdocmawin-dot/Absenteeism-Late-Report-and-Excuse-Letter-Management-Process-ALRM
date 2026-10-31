# ALRM Search Setup

The canonical search entry is https://absenteeism-late-report-and-excuse.vercel.app/login.
The root URL still follows the existing authenticated dashboard routing. No login,
OAuth, OTP, or backend behavior was changed for SEO.

## After Deploying

1. Open `/login` in Google Search Console's URL Inspection tool and run Test Live URL.
2. Check the rendered title, description, canonical URL, and Google indexing eligibility.
3. Submit `sitemap.xml` under Sitemaps, then request indexing for `/login`.
4. Verify `/robots.txt`, `/sitemap.xml`, and `/LV_Logo.webp` return their actual file
   contents rather than the application's HTML fallback.
5. Check that `/login` has no `X-Robots-Tag: noindex` response header, while
   `/dashboard`, `/student/records`, `/auth/callback`, and unknown pages do.

Only `/login` belongs in the sitemap. Vercel response headers exclude the other
application routes from indexing, including signed-out, verification, settings,
private dashboards, and error pages. These headers apply on Vercel, not the Vite
development server. They do not replace backend authentication or authorization.
Private pages remain crawlable so crawlers can see their `noindex` headers;
`robots.txt` blocks only the API namespace, not scripts or styles needed to render login.

The existing Search Console verification tag is retained in `index.html`.
`public/LV_Logo.webp` publishes the optimized school logo at a stable social-preview URL;
the favicon uses Vite's bundled asset so it shares the in-app logo's cache entry.
JSON-LD describes the actual educational web application, without invented ratings,
an unsupported search action, or a claim that this is the college's main website.

If the production domain changes, update `index.html`, `public/robots.txt`, and
`public/sitemap.xml` together, then verify the new Search Console property.
Indexing and search rankings are controlled by Google and are not immediate or guaranteed.
