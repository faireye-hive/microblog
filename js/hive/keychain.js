/**
 * Hive Keychain transport for Posting-authority custom_json operations.
 * Keeps browser dependency at the boundary; tests can inject a fake Keychain.
 */
export function hasHiveKeychain(keychain = globalThis.window?.hive_keychain) {
  return Boolean(keychain && typeof keychain.requestCustomJson === "function");
}

export function requestHiveCustomJson(
  account,
  customId,
  json,
  displayName,
  callback,
  keychain = globalThis.window?.hive_keychain
) {
  if (!hasHiveKeychain(keychain)) return false;
  keychain.requestCustomJson(
    account,
    customId,
    "Posting",
    json,
    displayName,
    callback
  );
  return true;
}
