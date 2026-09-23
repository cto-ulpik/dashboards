/**
 * Injects a fetch bridge so dashboards that call Anthropic (or OpenAI)
 * are redirected to our server proxy, which uses OPENAI_API_KEY.
 * Response shape matches Anthropic Messages API so existing Claude HTML works.
 */
function buildBridgeScript(dashboardId) {
  const id = String(dashboardId).replace(/[^a-zA-Z0-9-]/g, '');
  return `<script data-ai-bridge="1">
(function () {
  if (window.__DASHBOARD_AI_BRIDGE__) return;
  window.__DASHBOARD_AI_BRIDGE__ = true;
  var DASHBOARD_ID = ${JSON.stringify(id)};
  var PROXY = "/api/ai/chat";
  var ANTHROPIC_RE = /api\\.anthropic\\.com\\/v1\\/messages/i;
  var OPENAI_RE = /api\\.openai\\.com\\/v1\\/chat\\/completions/i;
  var nativeFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    init = init || {};
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (!ANTHROPIC_RE.test(url) && !OPENAI_RE.test(url)) {
      return nativeFetch(input, init);
    }

    var headers = new Headers(init.headers || {});
    headers.set("Content-Type", "application/json");
    headers.set("X-Dashboard-Id", DASHBOARD_ID);
    headers.delete("x-api-key");
    headers.delete("anthropic-version");
    headers.delete("authorization");
    headers.delete("Authorization");

    return nativeFetch(PROXY, {
      method: init.method || "POST",
      headers: headers,
      body: init.body,
      credentials: "same-origin",
      signal: init.signal
    });
  };
})();
</script>`;
}

function injectAiBridge(html, dashboardId) {
  const content = String(html || '');
  if (!content || /data-ai-bridge=["']1["']/.test(content)) {
    return content;
  }

  const bridge = buildBridgeScript(dashboardId);
  const headMatch = content.match(/<head[^>]*>/i);
  if (headMatch) {
    const idx = headMatch.index + headMatch[0].length;
    return content.slice(0, idx) + '\n' + bridge + content.slice(idx);
  }

  const htmlMatch = content.match(/<html[^>]*>/i);
  if (htmlMatch) {
    const idx = htmlMatch.index + htmlMatch[0].length;
    return content.slice(0, idx) + '\n' + bridge + content.slice(idx);
  }

  return bridge + '\n' + content;
}

module.exports = { injectAiBridge, buildBridgeScript };
