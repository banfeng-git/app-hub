/**
 * 应用数据接口（EdgeOne Pages Edge Function）
 * 若项目配置了环境变量 APPS_JSON，则优先返回变量里的应用数据；
 * 否则返回 404，前端自动回落到静态文件 /data/apps.json。
 * 不使用任何数据库。
 */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

export async function onRequestGet(context) {
  const env = context.env || {};
  const raw = env.APPS_JSON;

  if (!raw || !String(raw).trim()) {
    return json({ ok: false, code: "NO_ENV", message: "APPS_JSON 未配置，使用静态数据" }, 404);
  }

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || !Array.isArray(parsed.apps)) {
      return json({ ok: false, code: "BAD_JSON", message: "APPS_JSON 格式不正确，应包含 apps 数组" }, 500);
    }
    return json(parsed, 200);
  } catch (e) {
    return json({ ok: false, code: "PARSE_ERROR", message: "APPS_JSON 不是合法 JSON" }, 500);
  }
}

export async function onRequest() {
  return json({ ok: false, message: "Method Not Allowed" }, 405);
}
