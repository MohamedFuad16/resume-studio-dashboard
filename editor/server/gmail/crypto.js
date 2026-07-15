// AES-256-GCM for the Gmail refresh token at rest. The key comes from
// GMAIL_TOKEN_ENC_KEY (32 bytes as hex, base64, or raw). Tokens are only ever
// decrypted server-side, right before a Gmail API call — never sent to the client.
import crypto from 'crypto';

function loadKey() {
  const raw = process.env.GMAIL_TOKEN_ENC_KEY || '';
  if (!raw) return null;
  for (const enc of ['hex', 'base64']) {
    try {
      const buf = Buffer.from(raw, enc);
      if (buf.length === 32) return buf;
    } catch { /* try next */ }
  }
  const utf = Buffer.from(raw, 'utf8');
  if (utf.length === 32) return utf;
  // Any other length: derive a stable 32-byte key so dev keys of odd length still work.
  return crypto.createHash('sha256').update(raw).digest();
}

const KEY = loadKey();

export function encAvailable() {
  return Boolean(KEY);
}

export function encrypt(plaintext) {
  if (!KEY) throw new Error('GMAIL_TOKEN_ENC_KEY is not set');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decrypt(payload) {
  if (!KEY) throw new Error('GMAIL_TOKEN_ENC_KEY is not set');
  const [ivB64, tagB64, dataB64] = String(payload || '').split(':');
  if (!ivB64 || !tagB64 || !dataB64) throw new Error('malformed encrypted token');
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}
