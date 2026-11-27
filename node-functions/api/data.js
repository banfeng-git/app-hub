/**
 * 站点数据的云端读写（EdgeOne Makers Blob 存储）
 * GET  /api/data   -> 读云端数据（强一致），没有则 404，前端回落到静态 JSON
 * PUT  /api/data   -> 后台保存（需登录态 Cookie），写入云端后前台立即生效
 *
 * 存储结构：store「app-hub」下 key「data/site.json」，内容是 { site, updated, apps }
 */
import { getStore } from "@edgeone/pages-blob";
import crypto from "node:crypto";

const STORE = "app-hub";
const KEY = "data/site.json";
const MAX_BYTES = 1024 * 1024;
const COOKIE = "hub_admin";

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...headers
    }
  });
}

function tokenFor(password) {
  return crypto.createHash("sha256").update("apphub::login::v1::" + password).digest("hex").slice(0, 48);
}

function getCookie(request, name) {
  const raw = request.headers.get("cookie") || "";
  const hit = raw.split(";").map(s => s.trim()).find(s => s.startsWith(name + "="));
  return hit ? hit.slice(name.length + 1) : "";
}

export async function onRequestGet() {
  try {
    const store = getStore(STORE);
    const raw = await store.get(KEY, { consistency: "strong" });
    if (!raw) return json({ ok: false, code: "EMPTY", message: "云端暂无数据" }, 404);
    const text = typeof raw === "string" ? raw : raw.toString();
    return json(JSON.parse(text), 200);
  } catch (e) {
    return json({ ok: false, code: "READ_ERROR", message: String((e && e.message) || e) }, 500);
  }
}

export async function onRequestPut(context) {
  const env = context.env || {};
  const pw = env.ADMIN_PASSWORD;
  if (!pw) return json({ ok: false, code: "NO_PASSWORD", message: "服务端未配置 ADMIN_PASSWORD" }, 503);
  if (getCookie(context.request, COOKIE) !== tokenFor(pw)) {
    return json({ ok: false, code: "UNAUTHORIZED", message: "登录已过期，请重新登录" }, 401);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return json({ ok: false, code: "BAD_JSON", message: "请求体不是合法 JSON" }, 400);
  }
  if (!body || !Array.isArray(body.apps)) {
    return json({ ok: false, code: "BAD_SHAPE", message: "数据缺少 apps 数组" }, 400);
  }

  const payload = JSON.stringify({
    site: body.site && typeof body.site === "object" ? body.site : {},
    updated: body.updated || new Date().toISOString().slice(0, 10),
    apps: body.apps
  });
  if (payload.length > MAX_BYTES) {
    return json({ ok: false, code: "TOO_LARGE", message: "数据超过 1MB，请精简后再保存" }, 413);
  }

  try {
    const store = getStore(STORE);
    await store.set(KEY, payload);
    return json({ ok: true, bytes: payload.length, apps: body.apps.length }, 200);
  } catch (e) {
    return json({ ok: false, code: "WRITE_ERROR", message: String((e && e.message) || e) }, 500);
  }
}
