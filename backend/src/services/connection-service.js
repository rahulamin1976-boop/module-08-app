import { createTokenEncryption } from "../db/token-encryption.js";
import { createApiError } from "../middleware/error-handler.js";
import {
  loadAtlassianOAuthConfig,
  refreshAtlassianTokens,
  revokeAtlassianToken,
} from "../integrations/atlassian-oauth.js";

export function createConnectionService({
  pool,
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
}) {
  if (!pool) {
    throw new Error("A database pool is required for Atlassian connections.");
  }

  function getSettings() {
    const config = loadAtlassianOAuthConfig(env);
    return {
      config,
      encryption: createTokenEncryption(
        config.encryptionKey,
        config.encryptionKeyId,
      ),
    };
  }

  async function getState() {
    const result = await pool.query(
      `SELECT account_id, account_display_name, scopes, expires_at
       FROM integration_connections
       WHERE provider = 'atlassian_cloud'`,
    );
    if (result.rowCount === 0) {
      return { connected: false };
    }

    const connection = result.rows[0];
    return {
      connected: true,
      account: {
        id: connection.account_id,
        displayName: connection.account_display_name,
      },
      capabilities: connection.scopes,
      expiresAt: new Date(connection.expires_at).toISOString(),
    };
  }

  async function storeTokens({
    site,
    identity,
    tokens,
    confirmAccountSwitch,
  }) {
    const { config, encryption } = getSettings();
    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const current = await client.query(
        `SELECT account_id
         FROM integration_connections
         WHERE provider = 'atlassian_cloud'
         FOR UPDATE`,
      );
      if (
        current.rowCount > 0 &&
        current.rows[0].account_id !== identity.accountId &&
        confirmAccountSwitch !== true
      ) {
        throw createApiError(
          409,
          "ACCOUNT_SWITCH_CONFIRMATION_REQUIRED",
          "Confirm before replacing the connected Atlassian account.",
        );
      }

      const expiresAt = new Date(now().getTime() + tokens.expiresIn * 1000);
      await client.query(
        `INSERT INTO integration_connections (
           provider, cloud_id, account_id, account_display_name,
             site_url, access_token_ciphertext, refresh_token_ciphertext,
           encryption_key_reference, expires_at, scopes
         ) VALUES (
             'atlassian_cloud', $1, $2, $3, $4, $5, $6, $7, $8, $9
         )
         ON CONFLICT (provider) DO UPDATE SET
           cloud_id = EXCLUDED.cloud_id,
           account_id = EXCLUDED.account_id,
           account_display_name = EXCLUDED.account_display_name,
             site_url = EXCLUDED.site_url,
             access_token_ciphertext = EXCLUDED.access_token_ciphertext,
           refresh_token_ciphertext = EXCLUDED.refresh_token_ciphertext,
           encryption_key_reference = EXCLUDED.encryption_key_reference,
           expires_at = EXCLUDED.expires_at,
           scopes = EXCLUDED.scopes,
           updated_at = NOW()`,
        [
          site.cloudId,
          identity.accountId,
          identity.displayName,
          site.url,
          encryption.encrypt(tokens.accessToken),
          encryption.encrypt(tokens.refreshToken),
          config.encryptionKeyId,
          expiresAt,
          tokens.scopes,
        ],
      );
      await client.query("COMMIT");
      transactionOpen = false;
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function getAccessToken() {
    const { config, encryption } = getSettings();
    const client = await pool.connect();
    let transactionOpen = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const result = await client.query(
        `SELECT cloud_id, site_url, access_token_ciphertext, refresh_token_ciphertext,
                expires_at, scopes
         FROM integration_connections
         WHERE provider = 'atlassian_cloud'
         FOR UPDATE`,
      );
      if (result.rowCount === 0) {
        throw createApiError(401, "NOT_CONNECTED", "Connect an Atlassian account first.");
      }

      const connection = result.rows[0];
      if (new Date(connection.expires_at).getTime() > now().getTime() + 60_000) {
        const accessToken = encryption.decrypt(connection.access_token_ciphertext);
        await client.query("COMMIT");
        transactionOpen = false;
        return {
          cloudId: connection.cloud_id,
          siteUrl: connection.site_url,
          accessToken,
        };
      }

      let tokens;
      try {
        tokens = await refreshAtlassianTokens({
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          refreshToken: encryption.decrypt(connection.refresh_token_ciphertext),
          fetchImpl,
        });
      } catch {
        await client.query(
          "DELETE FROM integration_connections WHERE provider = 'atlassian_cloud'",
        );
        await client.query("COMMIT");
        transactionOpen = false;
        throw createApiError(
          401,
          "REAUTH_REQUIRED",
          "The Atlassian connection expired. Reconnect to continue.",
        );
      }

      const expiresAt = new Date(now().getTime() + tokens.expiresIn * 1000);
      await client.query(
        `UPDATE integration_connections
         SET access_token_ciphertext = $1,
             refresh_token_ciphertext = $2,
             expires_at = $3,
             scopes = $4,
             updated_at = NOW()
         WHERE provider = 'atlassian_cloud'`,
        [
          encryption.encrypt(tokens.accessToken),
          encryption.encrypt(tokens.refreshToken),
          expiresAt,
          tokens.scopes.length === 0 ? connection.scopes : tokens.scopes,
        ],
      );
      await client.query("COMMIT");
      transactionOpen = false;
      return {
        cloudId: connection.cloud_id,
        siteUrl: connection.site_url,
        accessToken: tokens.accessToken,
      };
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async function disconnect() {
    const client = await pool.connect();
    let transactionOpen = false;
    let providerRevoked = false;

    try {
      await client.query("BEGIN");
      transactionOpen = true;
      const result = await client.query(
        `SELECT refresh_token_ciphertext, encryption_key_reference
         FROM integration_connections
         WHERE provider = 'atlassian_cloud'
         FOR UPDATE`,
      );
      if (result.rowCount > 0) {
        try {
          const { config, encryption } = getSettings();
          const token = encryption.decrypt(result.rows[0].refresh_token_ciphertext);
          providerRevoked = await revokeAtlassianToken({
            clientId: config.clientId,
            clientSecret: config.clientSecret,
            token,
            fetchImpl,
          });
        } catch {
          providerRevoked = false;
        }
        await client.query(
          "DELETE FROM integration_connections WHERE provider = 'atlassian_cloud'",
        );
      }
      await client.query("COMMIT");
      transactionOpen = false;
      return { connected: false, providerRevoked };
    } catch (error) {
      if (transactionOpen) {
        await client.query("ROLLBACK");
      }
      throw error;
    } finally {
      client.release();
    }
  }

  return Object.freeze({ getState, storeTokens, getAccessToken, disconnect });
}
