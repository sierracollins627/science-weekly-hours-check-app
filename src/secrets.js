const { SecretsManager } = require("@mondaycom/apps-sdk");

const secretsManager = new SecretsManager();

let cache = null;

/**
 * Fetches all secrets this app needs via monday's SecretsManager SDK.
 * IMPORTANT: monday code Secrets are NOT exposed as plain process.env
 * variables the way regular Environment Variables are — they must be read
 * through this SDK's async get() method. Results are cached after the
 * first successful fetch within a given container's lifetime.
 */
async function getSecrets() {
  if (cache) return cache;

  // DIAGNOSTIC: log what keys the SDK can see at all, before trying to read values.
  try {
    const keys = await Promise.resolve(secretsManager.getKeys());
    console.log("SecretsManager.getKeys() returned:", JSON.stringify(keys));
  } catch (err) {
    console.error("SecretsManager.getKeys() threw:", String(err));
  }

  // secretsManager.get() may return a plain value or a Promise depending on
  // SDK version — Promise.resolve() handles both cases safely.
  const [monday_api_token, monday_app_id, monday_app_signing_secret, smtp_user, smtp_pass] =
    await Promise.all([
      Promise.resolve(secretsManager.get("MONDAY_API_TOKEN")),
      Promise.resolve(secretsManager.get("MONDAY_APP_ID")),
      Promise.resolve(secretsManager.get("MONDAY_APP_SIGNING_SECRET")),
      Promise.resolve(secretsManager.get("SMTP_USER")),
      Promise.resolve(secretsManager.get("SMTP_PASS")),
    ]);

  console.log("SecretsManager.get() raw results:", {
    MONDAY_API_TOKEN: typeof monday_api_token === "string" ? `string(len=${monday_api_token.length})` : monday_api_token,
    MONDAY_APP_ID: typeof monday_app_id === "string" ? `string(len=${monday_app_id.length})` : monday_app_id,
    MONDAY_APP_SIGNING_SECRET: typeof monday_app_signing_secret === "string" ? `string(len=${monday_app_signing_secret.length})` : monday_app_signing_secret,
    SMTP_USER: typeof smtp_user === "string" ? `string(len=${smtp_user.length})` : smtp_user,
    SMTP_PASS: typeof smtp_pass === "string" ? `string(len=${smtp_pass.length})` : smtp_pass,
  });

  cache = {
    MONDAY_API_TOKEN: monday_api_token,
    MONDAY_APP_ID: monday_app_id,
    MONDAY_APP_SIGNING_SECRET: monday_app_signing_secret,
    SMTP_USER: smtp_user,
    SMTP_PASS: smtp_pass,
  };

  const missing = Object.entries(cache)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    console.error(`SecretsManager returned empty for: ${missing.join(", ")}`);
  }

  return cache;
}

module.exports = { getSecrets };
