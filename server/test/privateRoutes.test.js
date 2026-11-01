const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const profileRoutes = require("../routes/profileRoutes");
const applicationRoutes = require("../routes/applicationRoutes");

test("profile, resume, and application APIs require an authenticated bearer token", async (context) => {
  const app = express();
  app.use(express.json());
  app.use("/api/profile", profileRoutes);
  app.use("/api/applications", applicationRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject) });
  context.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const requests = [
    ["GET", "/api/profile"],
    ["PUT", "/api/profile"],
    ["GET", "/api/profile/readiness"],
    ["GET", "/api/profile/resume"],
    ["POST", "/api/profile/resume"],
    ["DELETE", "/api/profile/resume"],
    ["POST", "/api/profile/photo"],
    ["DELETE", "/api/profile/photo"],
    ["GET", "/api/applications/job/64b000000000000000000002"],
    ["POST", "/api/applications/64b000000000000000000002"],
  ];
  for (const [method, route] of requests) {
    const response = await fetch(`${origin}${route}`, { method, headers: method === "PUT" ? { "Content-Type": "application/json" } : undefined, body: method === "PUT" ? "{}" : undefined });
    assert.equal(response.status, 401, `${method} ${route} should require authentication`);
  }
});
