import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { startServer } from "../src/server.js";

test("server listens on loopback and serves its health endpoint", async (t) => {
  const server = startServer({ port: 0 });
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  assert.equal(address.address, "127.0.0.1");

  const response = await fetch(`http://127.0.0.1:${address.port}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });

  const missingRoute = await fetch(`http://127.0.0.1:${address.port}/missing`);
  assert.equal(missingRoute.status, 404);
  assert.deepEqual(await missingRoute.json(), {
    error: { code: "NOT_FOUND", message: "Route not found." },
  });
});
