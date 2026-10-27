/**
 * OpenPGP support for Sloth Lee Mail.
 *
 * Two independent layers of protection exist here, and they are not the same
 * thing:
 *
 *   * the built-in E2EE (RSA key pair, key wrapped with the login password)
 *     protects mail *at rest on this server*
 *   * OpenPGP protects a message *in transit and at the recipient*, and works
 *     with people who do not use this server at all
 *
 * Keys live in the browser only. The private key is stored passphrase-encrypted
 * (OpenPGP does that itself); the passphrase is never persisted anywhere, so
 * decrypting always requires the user to type it.
 */

import * as openpgp from 'openpgp'

const RING_KEY = 'sloth.pgp.keyring.v1'

function emptyRing() {
  return { identity: null, contacts: {} }
}

export function loadRing() {
  try {
    const raw = localStorage.getItem(RING_KEY)
    if (!raw) return emptyRing()
    const parsed = JSON.parse(raw)
    const contacts = {}
    for (const [email, value] of Object.entries(parsed.contacts ?? {})) {
      // Older rings stored bare armor. Normalise to {armored, fingerprint} so
      // every contact has a pin to compare future imports against.
      contacts[email] = typeof value === 'string' ? { armored: value, fingerprint: null } : value
    }
    return { identity: parsed.identity ?? null, contacts }
  } catch {
    return emptyRing()
  }
}

function contactArmor(contact) {
  return typeof contact === 'string' ? contact : contact?.armored ?? ''
}

function contactFingerprint(contact) {
  return typeof contact === 'string' ? null : contact?.fingerprint ?? null
}

function saveRing(ring) {
  localStorage.setItem(RING_KEY, JSON.stringify(ring))
  return ring
}

/** The account's own OpenPGP identity, or null when none has been created. */
export function getIdentity() {
  return loadRing().identity
}

export function hasIdentity() {
  return !!loadRing().identity
}

/**
 * Create a new OpenPGP key pair for this account.
 *
 * curve25519 is used rather than RSA-4096: same practical strength for mail,
 * far smaller keys and much faster generation in a browser.
 */
export async function generateIdentity({ name, email, passphrase }) {
  if (!name?.trim()) throw new Error('A name is required')
  if (!email?.includes('@')) throw new Error('A valid email is required')
  if (!passphrase || passphrase.length < 8) {
    throw new Error('Use a passphrase of at least 8 characters')
  }

  const { publicKey, privateKey } = await openpgp.generateKey({
    type: 'ecc',
    curve: 'curve25519Legacy',
    userIDs: [{ name: name.trim(), email: email.trim().toLowerCase() }],
    passphrase,
    format: 'armored',
  })

  const publicKeyObj = await openpgp.readKey({ armoredKey: publicKey })
  const fingerprint = publicKeyObj.getFingerprint().toUpperCase()

  const ring = loadRing()
  ring.identity = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    publicKey,
    privateKey,
    fingerprint,
    createdAt: Date.now(),
  }
  // Your own key is also the key used when you mail yourself.
  ring.contacts[ring.identity.email] = { armored: publicKey, fingerprint }
  saveRing(ring)
  return ring.identity
}

export function exportPublicKey() {
  return loadRing().identity?.publicKey ?? null
}

export function forgetIdentity() {
  const ring = loadRing()
  if (ring.identity) {
    delete ring.contacts[ring.identity.email]
  }
  ring.identity = null
  saveRing(ring)
}

/** Import somebody else's public key so mail to them can be encrypted. */
/**
 * Why an imported key cannot be used, or null when it is fine.
 *
 * Trust-on-first-use with the honest exception: a key that has expired or been
 * revoked must never silently replace a working one.
 */
async function keyProblem(key) {
  // isRevoked() is async in openpgp v6 — treating its Promise as a boolean makes
  // every key look revoked.
  if (typeof key.isRevoked === 'function') {
    const revoked = await key.isRevoked()
    if (revoked) return 'That key has been revoked'
  }
  // getExpirationTime() is async in openpgp v6 and hands back a Date, a
  // timestamp or Infinity; awaiting a non-Promise is harmless, so resolve first.
  let expiration = key.getExpirationTime?.()
  if (expiration && typeof expiration.then === 'function') expiration = await expiration
  let expiresAt = null
  if (expiration instanceof Date) expiresAt = expiration.getTime()
  else if (typeof expiration === 'number' && Number.isFinite(expiration)) {
    expiresAt = expiration < 1e12 ? expiration * 1000 : expiration
  }
  if (expiresAt !== null && expiresAt < Date.now()) return 'That key has expired'

  const algo = key.getAlgorithmInfo?.()
  if (algo?.algorithm === 'rsa' && algo.bits && algo.bits < 2048) {
    return `That RSA key is only ${algo.bits} bits — 2048 or more is required`
  }
  if (!key.getUserIDs?.()?.length) return 'That key has no user ID'
  return null
}

export async function importPublicKey(armored, { replace = false } = {}) {
  const key = await openpgp.readKey({ armoredKey: armored.trim() })
  const problem = await keyProblem(key)
  if (problem) throw new Error(problem)

  const userID = key.getUserIDs()?.[0] ?? ''
  const match = userID.match(/<([^>]+)>/)
  const email = (match ? match[1] : userID).trim().toLowerCase()
  if (!email.includes('@')) {
    throw new Error('That key has no email address attached')
  }

  const fingerprint = key.getFingerprint().toUpperCase()
  const ring = loadRing()
  const existing = ring.contacts[email]

  // Key change for an address you already trust is exactly how a MITM wins.
  if (existing && !replace) {
    const pinned = contactFingerprint(existing)
    if (pinned && pinned !== fingerprint) {
      const err = new Error(
        `A different key is already saved for ${email} (…${pinned.slice(-16)}). ` +
          `Accepting this one replaces that trust.`,
      )
      err.code = 'key_fingerprint_changed'
      err.pinned = pinned
      err.incoming = fingerprint
      throw err
    }
  }

  ring.contacts[email] = { armored: key.toPublic().armor(), fingerprint }
  saveRing(ring)
  return { email, fingerprint }
}

/**
 * Import an exported private key (.asc) so this browser can *read* mail sent to
 * that identity — the path for using one OpenPGP key on a phone and a desktop.
 *
 * The key stays passphrase-protected; the passphrase is asked for at send and
 * decrypt time, never stored.
 */
export async function importPrivateKeyFile(armored) {
  const text = (armored ?? '').trim()
  if (!text.includes('PRIVATE KEY BLOCK')) {
    throw new Error('That is not a private key file')
  }

  const key = await openpgp.readPrivateKey({ armoredKey: text })
  if (key.isDecrypted()) {
    throw new Error(
      'That key has no passphrase, which is unsafe to store in a browser. Export it again with a passphrase.',
    )
  }

  const userID = key.getUserIDs()?.[0] ?? ''
  const match = userID.match(/<([^>]+)>/)
  const email = (match ? match[1] : userID).trim().toLowerCase()
  if (!email.includes('@')) throw new Error('That key has no email address attached')
  const name = userID.replace(/<[^>]+>/g, '').replace(/\(.*\)/g, '').trim() || email

  const publicKey = key.toPublic().armor()
  const ring = loadRing()
  ring.identity = {
    name,
    email,
    publicKey,
    privateKey: key.armor(),
    fingerprint: key.getFingerprint().toUpperCase(),
    createdAt: Date.now(),
    imported: true,
  }
  ring.contacts[email] = { armored: publicKey, fingerprint: key.getFingerprint().toUpperCase() }
  saveRing(ring)
  return ring.identity
}

/** Import any .asc file: private keys become the identity, public keys a contact. */
export async function importKeyFile(armored) {
  const text = (armored ?? '').trim()
  if (text.includes('PRIVATE KEY BLOCK')) {
    const identity = await importPrivateKeyFile(text)
    return { kind: 'private', email: identity.email }
  }
  if (text.includes('PUBLIC KEY BLOCK')) {
    const { email } = await importPublicKey(text)
    return { kind: 'public', email }
  }
  throw new Error('That file is not a PGP key')
}

export function removeContact(email) {
  const ring = loadRing()
  delete ring.contacts[email.toLowerCase()]
  saveRing(ring)
}

export function listContacts() {
  return Object.entries(loadRing().contacts).map(([email, contact]) => ({
    email,
    armored: contactArmor(contact),
    fingerprint: contactFingerprint(contact),
  }))
}

/** Which of these addresses can receive OpenPGP mail from this browser. */
export function keyCoverage(addresses) {
  const ring = loadRing()
  const missing = addresses
    .map((a) => (a ?? '').toLowerCase().trim())
    .filter(Boolean)
    .filter((a) => !contactArmor(ring.contacts[a]) || !ring.contacts[a])
  return { canEncrypt: missing.length === 0 && addresses.length > 0, missing }
}

/**
 * Encrypt (and sign, when an identity exists) a message body for every
 * recipient. Returns armored PGP text suitable for an ordinary mail body.
 */

/** Recipients plus yourself — a message you cannot decrypt later is a lost message. */
function withSelf(recipients) {
  const ring = loadRing()
  const list = (recipients ?? []).map((a) => (a ?? '').toLowerCase().trim()).filter(Boolean)
  const own = ring.identity?.email
  if (own && !list.includes(own) && contactArmor(ring.contacts[own])) list.push(own)
  return list
}

export async function encryptBody({ text, recipients, passphrase }) {
  const ring = loadRing()
  const targets = withSelf(recipients)
  const coverage = keyCoverage(targets)
  if (!coverage.canEncrypt) {
    throw new Error(`No OpenPGP key for: ${coverage.missing.join(', ')}`)
  }

  const encryptionKeys = await Promise.all(
    targets.map((address) => openpgp.readKey({ armoredKey: contactArmor(ring.contacts[address]) })),
  )

  let signingKeys
  if (ring.identity) {
    signingKeys = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: ring.identity.privateKey }),
      passphrase,
    })
  }

  return openpgp.encrypt({
    message: await openpgp.createMessage({ text }),
    encryptionKeys,
    signingKeys,
    format: 'armored',
  })
}

/**
 * Encrypt a file's bytes for a set of recipients.
 *
 * Inline PGP can only protect a body, so attachments travel as their own
 * encrypted file: the recipient downloads an .asc and decrypts it with the same
 * passphrase. That keeps attachments inside the existing send pipeline instead
 * of needing PGP/MIME support from the server.
 */
export async function encryptAttachment({ bytes, recipients, passphrase }) {
  const ring = loadRing()
  const targets = withSelf(recipients)
  const coverage = keyCoverage(targets)
  if (!coverage.canEncrypt) {
    throw new Error(`No OpenPGP key for: ${coverage.missing.join(', ')}`)
  }

  const encryptionKeys = await Promise.all(
    targets.map((address) => openpgp.readKey({ armoredKey: contactArmor(ring.contacts[address]) })),
  )

  let signingKeys
  if (ring.identity) {
    signingKeys = await openpgp.decryptKey({
      privateKey: await openpgp.readPrivateKey({ armoredKey: ring.identity.privateKey }),
      passphrase,
    })
  }

  return openpgp.encrypt({
    message: await openpgp.createMessage({ binary: bytes }),
    encryptionKeys,
    signingKeys,
    format: 'armored',
  })
}

/** Decrypt an .asc attachment back into raw bytes. */
export async function decryptAttachment({ armored, passphrase }) {
  const ring = loadRing()
  if (!ring.identity) throw new Error('This browser has no OpenPGP key to decrypt with')

  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: ring.identity.privateKey }),
    passphrase,
  })

  const message = await openpgp.readMessage({ armoredMessage: (armored ?? '').trim() })
  const { data } = await openpgp.decrypt({ message, decryptionKeys: privateKey, format: 'binary' })
  return data
}

export function looksEncrypted(text) {
  return typeof text === 'string' && text.includes('-----BEGIN PGP MESSAGE-----')
}

/**
 * Decrypt an armored message and report the signature state.
 *
 * `signature` is 'none' when the message is unsigned, 'good' when a signature
 * verifies against a key we hold, and 'unverified' when signed by an unknown key
 * (which is not a failure — it just means we cannot confirm who sent it).
 */
/**
 * Which saved key produced this signature, if any. Matching on key ID covers
 * subkeys, which is what actually signs in most real keys.
 */
function fingerprintForKeyId(keys, keyId) {
  if (!keyId) return null
  const wanted = keyId.toHex().toUpperCase()
  for (const key of keys) {
    const own = key.getFingerprint().toUpperCase()
    if (key.getKeyIDs().some((k) => k.toHex().toUpperCase() === wanted)) return own
    const subkeys = key.getSubkeys?.() ?? []
    for (const sub of subkeys) {
      if (sub.getKeyID().toHex().toUpperCase() === wanted) return own
    }
  }
  return null
}

export function addressOf(header) {
  const match = String(header ?? '').match(/<([^>]+)>/)
  return (match ? match[1] : String(header ?? '')).trim().toLowerCase()
}

/**
 * Decrypt and classify the signature against the key pinned for the *sender*.
 *
 * Verifying against every key we happen to hold is a classic mistake: it proves
 * "someone we know signed this", not "the person it claims to be from signed it".
 * States: none | good | wrong-signer | unknown-signer | bad-signature.
 */
export async function decryptBody({ armored, passphrase, sender }) {
  const ring = loadRing()
  if (!ring.identity) throw new Error('This browser has no OpenPGP key to decrypt with')

  const privateKey = await openpgp.decryptKey({
    privateKey: await openpgp.readPrivateKey({ armoredKey: ring.identity.privateKey }),
    passphrase,
  })

  const message = await openpgp.readMessage({ armoredMessage: armored.trim() })

  const knownKeys = []
  const fingerprintByEmail = {}
  for (const [email, contact] of Object.entries(ring.contacts)) {
    const armor = contactArmor(contact)
    if (!armor) continue
    try {
      const key = await openpgp.readKey({ armoredKey: armor })
      knownKeys.push(key)
      fingerprintByEmail[email] = key.getFingerprint().toUpperCase()
    } catch {
      // a corrupt pinned key must not stop decryption
    }
  }

  const { data, signatures } = await openpgp.decrypt({
    message,
    decryptionKeys: privateKey,
    verificationKeys: knownKeys.length ? knownKeys : undefined,
    format: 'utf8',
  })

  let signature = 'none'
  let signerFingerprint = null
  let signerEmail = null

  if (signatures?.length) {
    const senderEmail = addressOf(sender)
    const pinned = senderEmail ? fingerprintByEmail[senderEmail] ?? null : null

    let verified = false
    for (const sig of signatures) {
      signerFingerprint = fingerprintForKeyId(knownKeys, sig.keyID) ?? signerFingerprint
      try {
        await sig.verified
        verified = true
        break
      } catch {
        // try the next signature
      }
    }

    for (const [email, fp] of Object.entries(fingerprintByEmail)) {
      if (fp && fp === signerFingerprint) { signerEmail = email; break }
    }

    if (!verified) signature = 'bad-signature'
    else if (!pinned) signature = 'unknown-signer'
    else if (pinned === signerFingerprint) signature = 'good'
    else signature = 'wrong-signer'
  }

  return { text: data, signature, signerFingerprint, signerEmail }
}

/** The identity's public key dearmored and base64'd, as WKD publishing needs. */
export async function publishableKey() {
  const ring = loadRing()
  if (!ring.identity) throw new Error('This browser has no OpenPGP key yet')
  const key = await openpgp.readKey({ armoredKey: ring.identity.publicKey })
  const bytes = key.write()
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
  return {
    keyB64: btoa(binary),
    fingerprint: key.getFingerprint().toUpperCase(),
    email: ring.identity.email,
  }
}

/** Armored private key for backup. Still protected by the passphrase. */
export function exportPrivateKey() {
  return loadRing().identity?.privateKey ?? null
}

