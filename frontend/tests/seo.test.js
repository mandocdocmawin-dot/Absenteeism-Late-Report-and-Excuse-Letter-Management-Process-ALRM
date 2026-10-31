import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const origin = "https://absenteeism-late-report-and-excuse.vercel.app";
const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("public metadata identifies ALRM and La Verdad without losing Search Console verification", async () => {
  const html = await read("index.html");
  assert.match(html, /<title>ALRM System \| La Verdad Christian College<\/title>/);
  assert.match(html, /name="description"\s+content="[^"]*La Verdad Christian College[^"]*absence[^"]*late[^"]*excuse/i);
  assert.ok(html.includes(`href="${origin}/"`));
  assert.ok(html.includes(`content="${origin}/"`));
  assert.match(html, /content="l5W2w8vUhhFO7Ix3C2he42RYNwvtDK4AoPxOtRFvNis"/);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.doesNotMatch(html, /name="robots"[^>]*noindex/);
  assert.match(html, /property="og:site_name"/);
  assert.match(html, /name="twitter:card"/);
});

test("structured data describes the real educational app without invented ratings or search actions", async () => {
  const html = await read("index.html");
  const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(json, "the public page needs structured data");
  const app = JSON.parse(json);
  assert.equal(app["@context"], "https://schema.org");
  assert.equal(app["@type"], "WebApplication");
  assert.equal(app.name, "ALRM System");
  assert.equal(app.url, `${origin}/`);
  assert.equal(app.applicationCategory, "EducationalApplication");
  assert.equal(app.image, `${origin}/LV_Logo.webp`);
  assert.equal(app.aggregateRating, undefined);
  assert.equal(app.potentialAction, undefined);
});

test("the sitemap promotes the canonical public landing page and robots permits its crawl", async () => {
  const sitemap = await read("public/sitemap.xml");
  assert.match(sitemap, /xmlns="http:\/\/www.sitemaps.org\/schemas\/sitemap\/0.9"/);
  assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]), [`${origin}/`]);
  const robots = await read("public/robots.txt");
  assert.match(robots, /User-agent: \*/);
  assert.match(robots, /Allow: \/\s/);
  assert.match(robots, /Disallow: \/api\//);
  assert.ok(robots.includes(`Sitemap: ${origin}/sitemap.xml`));
  assert.doesNotMatch(robots, /Disallow: \/(?:\s|login)/);
});

test("Vercel excludes private and unknown pages from search without blocking public metadata assets", async () => {
  const config = JSON.parse(await read("vercel.json"));
  const exclusions = (config.headers || []).filter(rule => rule.headers.some(header =>
    header.key.toLowerCase() === "x-robots-tag" && header.value.includes("noindex")));
  const excluded = path => exclusions.some(rule => new RegExp(`^${rule.source}$`).test(path));
  for (const path of ["/dashboard", "/student/records", "/student/request", "/settings", "/signed-out", "/instructors", "/students/1", "/classes", "/programs", "/reports", "/program-head/requests", "/instructor/class-requests", "/verify-otp", "/auth/callback", "/api/auth/google/callback", "/404", "/unknown-page", "/login/private"]) {
    assert.equal(excluded(path), true, path);
  }
  for (const path of ["/", "/login", "/login/", "/assets/index.js", "/assets/index.css", "/LV_Logo.webp", "/sitemap.xml", "/robots.txt"]) {
    assert.equal(excluded(path), false, path);
  }
  assert.deepEqual(config.rewrites, [
    { source: "/api/:path*", destination: "/api/gateway?__alrm_path=:path*" },
    { source: "/(.*)", destination: "/index.html" },
  ]);
});

test("social previews and the favicon use a published copy of the current school logo", async () => {
  const logo = await readFile(new URL("../public/LV_Logo.webp", import.meta.url));
  assert.equal(logo.subarray(0, 4).toString(), "RIFF");
  assert.equal(logo.subarray(8, 12).toString(), "WEBP");
  const html = await read("index.html");
  assert.ok(html.includes(`content="${origin}/LV_Logo.webp"`));
  assert.match(html, /rel="icon" type="image\/webp" href="\/src\/assets\/lv-logo-sidebar.webp"/);
});
