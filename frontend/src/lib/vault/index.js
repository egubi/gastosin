/**
 * vault.js — AES-256 encrypt/decrypt for optional encrypted vault mode
 *
 * Key is derived from a user-held passphrase using PBKDF2.
 * Nothing is stored in plaintext. The key never leaves the browser.
 *
 * Storage backend: IndexedDB (via idb) for MVP.
 * Architecture must remain swappable to server-side storage later.
 */

// TODO: implement
export async function encrypt(data, passphrase) {
  throw new Error('Not implemented')
}

export async function decrypt(ciphertext, passphrase) {
  throw new Error('Not implemented')
}
