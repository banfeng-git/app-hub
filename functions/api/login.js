/**
 * 后台登录接口（EdgeOne Pages Edge Function）
 * 密码来自 Pages 环境变量 ADMIN_PASSWORD，不落库、不写进代码。
 * GET    /api/login  -> { configured, authed }
 * POST   /api/login  -> { ok } + Set-Cookie（body: { password })
 * DELETE /api/login  -> 退出登录
 */

const COOKIE = "hub_admin";
const MAX_AGE = 60 * 60 * 12; // 12 小时

async function sha256hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function tokenFor(password) {
  return (await sha256hex("apphub::login::v1::" + password)).slice(0, 48);
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

function getCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  const hit = raw.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  return hit ? hit.slice(name.length + 1) : "";
}

function isHttps(request) {
  return (request.headers.get("x-forwarded-proto") || "").includes("https");
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const pw = env.ADMIN_PASSWORD;
  if (!pw) return json({ configured: false, authed: false }, 200);

  const cookies = getCookie(context.request, COOKIE);
  const authed = cookies && cookies === (await tokenFor(pw));
  return json({
    configured: true,
    authed: !!authed,
    dataSource: env.APPS_JSON ? "env" : "static"
  });
}

export async function onRequestPost(context) {
  const env = context.env || {};
  const pw = env.ADMIN_PASSWORD;
  if (!pw) {
    return json({ ok: false, code: "NO_PASSWORD", message: "服务端未配置 ADMIN_PASSWORD 环境变量" }, 503);
  }

  let body = {};
  try { body = await context.request.json(); } catch (e) { body = {}; }
  const input = String(body.password || "").trim();
  if (!input) return json({ ok: false, message: "请输入密码" }, 400);

  // 简单退避，降低暴力尝试速度
  if (input !== pw) {
    await new Promise(r => setTimeout(r, 300));
    return json({ ok: false, message: "密码不正确，请重试" }, 401);
  }

  const token = await tokenFor(pw);
  const parts = [
    `${COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE}`
  ];
  if (isHttps(context.request)) parts.push("Secure");

  return json({ ok: true }, 200, { "set-cookie": parts.join("; ") });
}

export async function onRequestDelete(context) {
  return json({ ok: true }, 200, {
    "set-cookie": `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  });
}

export async function onRequest() {
  return json({ ok: false, message: "Method Not Allowed" }, 405);
}
