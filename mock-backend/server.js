const http = require("http");

const PORT = 3000;

const server = http.createServer((req, res) => {
  // Cấu hình CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Extension-Source");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = "";
  req.on("data", chunk => {
    body += chunk;
  });

  req.on("end", () => {
    const authHeader = req.headers["authorization"] || "";
    const extSource = req.headers["x-extension-source"] || "";
    
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
    console.log(`  - Source Header: ${extSource}`);
    console.log(`  - Authorization Header: ${authHeader}`);
    
    let parsedBody = {};
    if (body) {
      try {
        parsedBody = JSON.parse(body);
        const logBody = JSON.parse(JSON.stringify(parsedBody));
        
        // Tránh in mật mã thật lên console của mock server
        if (logBody.sessionData && logBody.sessionData.cookies) {
          logBody.sessionData.cookies = logBody.sessionData.cookies.map(c => ({
            name: c.name,
            value: c.value ? c.value.substring(0, 3) + "***" + c.value.substring(c.value.length - 3) : "",
            domain: c.domain
          }));
        }
        
        console.log(`  - Payload:`, JSON.stringify(logBody, null, 2));
      } catch (e) {
        console.log(`  - Raw Body: ${body}`);
      }
    }

    // Xử lý Health Check
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, status: "HEALTHY", message: "Server is healthy" }));
      return;
    }

    // Xử lý Check Session
    if (req.method === "POST" && req.url === "/api/extension/check-session") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, valid: true }));
      return;
    }

    // Xử lý Sync Session
    if (req.method === "POST" && req.url === "/api/extension/sync-session") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, synced: true, message: "Đồng bộ thành công." }));
      return;
    }

    // Xử lý Log Event
    if (req.method === "POST" && req.url === "/api/extension/log-event") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, logged: true }));
      return;
    }

    // Endpoint không tồn tại
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: { message: "Endpoint không tìm thấy." } }));
  });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`[MOCK SERVER] Chạy tại: http://localhost:${PORT}`);
  console.log(`Các API khả dụng:`);
  console.log(`  - GET  /health`);
  console.log(`  - POST /api/extension/check-session`);
  console.log(`  - POST /api/extension/sync-session`);
  console.log(`  - POST /api/extension/log-event`);
  console.log(`==================================================\n`);
});
