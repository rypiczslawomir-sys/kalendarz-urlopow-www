#!/usr/bin/env node
"use strict";

const API_KEY = process.env.RENDER_API_KEY || "";
const SERVICE_ID = process.env.RENDER_SERVICE_ID || "";
const SERVICE_NAME = process.env.RENDER_SERVICE_NAME || "kalendarz-urlopow-9vvb";

async function api(path, options = {}) {
  const res = await fetch(`https://api.render.com/v1${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`Render API ${res.status}: ${typeof body === "string" ? body : JSON.stringify(body)}`);
  }
  return body;
}

async function resolveServiceId() {
  if (SERVICE_ID) return SERVICE_ID;
  let cursor;
  do {
    const q = new URLSearchParams({ limit: "50" });
    if (cursor) q.set("cursor", cursor);
    const page = await api(`/services?${q}`);
    for (const row of page || []) {
      const svc = row.service || row;
      if (svc?.name === SERVICE_NAME || svc?.slug === SERVICE_NAME) return svc.id;
    }
    cursor = page?.[page.length - 1]?.cursor;
  } while (cursor);
  throw new Error(`Nie znaleziono usługi "${SERVICE_NAME}" — ustaw RENDER_SERVICE_ID`);
}

async function main() {
  if (!API_KEY) {
    console.error("Brak RENDER_API_KEY. Utwórz klucz: https://dashboard.render.com/u/settings#api-keys");
    process.exit(1);
  }
  const serviceId = await resolveServiceId();
  const deploy = await api(`/services/${serviceId}/deploys`, {
    method: "POST",
    body: JSON.stringify({ clearCache: "clear", deployMode: "build_and_deploy" }),
  });
  console.log("Deploy uruchomiony:", deploy.id, deploy.status);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
