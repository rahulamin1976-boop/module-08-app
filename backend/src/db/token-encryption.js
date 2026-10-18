import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = "v1";

export function createTokenEncryption(keyMaterial, keyReference) {
  if (typeof keyMaterial !== "string" || keyMaterial.length === 0) {
    throw new Error("A base64url token-encryption key is required.");
  }

  const key = Buffer.from(keyMaterial, "base64url");
  if (
    key.length !== 32 ||
    key.toString("base64url") !== keyMaterial ||
    typeof keyReference !== "string" ||
    keyReference.trim() === ""
  ) {
    throw new Error("Token-encryption configuration is invalid.");
  }

  return Object.freeze({
    keyReference,
    encrypt(plaintext) {
      if (typeof plaintext !== "string" || plaintext.length === 0) {
        throw new Error("A non-empty token is required for encryption.");
      }

      const iv = randomBytes(IV_LENGTH);
      const cipher = createCipheriv(ALGORITHM, key, iv);
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, "utf8"),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      return [
        VERSION,
        iv.toString("base64url"),
        tag.toString("base64url"),
        ciphertext.toString("base64url"),
      ].join(".");
    },
    decrypt(value) {
      if (typeof value !== "string") {
        throw new Error("Encrypted token data is invalid.");
      }

      const [version, encodedIv, encodedTag, encodedCiphertext, extra] =
        value.split(".");
      if (
        version !== VERSION ||
        extra !== undefined ||
        !encodedIv ||
        !encodedTag ||
        !encodedCiphertext
      ) {
        throw new Error("Encrypted token data is invalid.");
      }

      const iv = Buffer.from(encodedIv, "base64url");
      const tag = Buffer.from(encodedTag, "base64url");
      const ciphertext = Buffer.from(encodedCiphertext, "base64url");
      if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
        throw new Error("Encrypted token data is invalid.");
      }

      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");
    },
  });
}
