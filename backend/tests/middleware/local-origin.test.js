import test from "node:test";
import assert from "node:assert/strict";
import { localOrigin } from "../../src/middleware/local-origin.js";

function check({ method = "GET", host, origin, remoteAddress = "127.0.0.1" }) {
  let error;
  const request = {
    method,
    protocol: "http",
    socket: { remoteAddress },
    get(name) {
      return name === "host" ? host : origin;
    },
  };
  localOrigin(request, {}, (received) => {
    error = received;
  });
  return error;
}

test("local-origin middleware accepts loopback safe requests and matching origins", () => {
  assert.equal(check({ host: "127.0.0.1:3001" }), undefined);
  assert.equal(
    check({
      method: "POST",
      host: "localhost:3001",
      origin: "http://localhost:3001",
      remoteAddress: "::ffff:127.0.0.1",
    }),
    undefined,
  );
});

test("local-origin middleware rejects remote hosts and clients", () => {
  assert.equal(
    check({ host: "192.168.1.5:3001" }).code,
    "LOCAL_ACCESS_ONLY",
  );
  assert.equal(
    check({ host: "127.0.0.1:3001", remoteAddress: "192.168.1.20" }).code,
    "LOCAL_ACCESS_ONLY",
  );
});

test("state-changing requests require an exact same-origin match", () => {
  assert.equal(
    check({ method: "POST", host: "127.0.0.1:3001" }).code,
    "ORIGIN_REQUIRED",
  );
  assert.equal(
    check({
      method: "POST",
      host: "127.0.0.1:3001",
      origin: "http://localhost:3001",
    }).code,
    "CROSS_ORIGIN_REQUEST",
  );
  assert.equal(
    check({
      method: "POST",
      host: "127.0.0.1:3001",
      origin: "https://127.0.0.1:3001",
    }).code,
    "CROSS_ORIGIN_REQUEST",
  );
});
