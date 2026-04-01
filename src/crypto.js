
import { argon2id, bcrypt } from 'hash-wasm'
import forge from 'node-forge'
import KeygenWorker from './keygen.worker.js?worker&inline'

// true when the Web Crypto API is available (requires a secure context / HTTPS)
export const hasSubtleCrypto = typeof crypto !== 'undefined' && !!crypto.subtle

// ─── Binary helpers ───────────────────────────────────────────────────────────

function toB64(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function fromB64(b64) {
  const bin = atob(b64)
  const buf = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
  return buf
}

function toForgeBin(u8) {
  let s = ''
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i])
  return s
}

function fromForgeBin(s) {
  const u8 = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i)
  return u8
}

function hexToBytes(hex) {
  const arr = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2)
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  return arr
}

// RSA-OAEP params for forge — must match WebCrypto (SHA-256 hash + SHA-256 MGF1)
function forgeOaepParams() {
  return { md: forge.md.sha256.create(), mgf1: { md: forge.md.sha256.create() } }
}

// ─── Forge key helpers ────────────────────────────────────────────────────────

// Pack a forge private key as PKCS#8 DER bytes (same wire format as WebCrypto exportKey('pkcs8'))
function forgePrivToPkcs8Bytes(forgePrivKey) {
  const inner   = forge.pki.privateKeyToAsn1(forgePrivKey)
  const wrapped = forge.pki.wrapRsaPrivateKey(inner)
  return fromForgeBin(forge.asn1.toDer(wrapped).getBytes())
}

// Unpack PKCS#8 DER bytes into a forge private key
function pkcs8BytesToForgePriv(bytes) {
  const asn1     = forge.asn1.fromDer(toForgeBin(bytes))
  const innerDer = asn1.value[2].value          // OCTET STRING contents = RSAPrivateKey
  const innerAsn1 = forge.asn1.fromDer(innerDer)
  return forge.pki.privateKeyFromAsn1(innerAsn1)
}

// ─── Forge AES-GCM ────────────────────────────────────────────────────────────
// Both functions use the same layout as WebCrypto: output = ciphertext || tag(16 bytes)

function forgeAesGcmEncrypt(keyBytes, ivBytes, plainBytes) {
  const cipher = forge.cipher.createCipher('AES-GCM', forge.util.createBuffer(toForgeBin(keyBytes)))
  cipher.start({ iv: forge.util.createBuffer(toForgeBin(ivBytes)) })
  cipher.update(forge.util.createBuffer(toForgeBin(plainBytes)))
  cipher.finish()
  const ct  = fromForgeBin(cipher.output.getBytes())
  const tag = fromForgeBin(cipher.mode.tag.getBytes())
  const out = new Uint8Array(ct.length + tag.length)
  out.set(ct, 0)
  out.set(tag, ct.length)
  return out
}

function forgeAesGcmDecrypt(keyBytes, ivBytes, combinedBytes) {
  const tagLen = 16
  const ct  = combinedBytes.slice(0, combinedBytes.length - tagLen)
  const tag = combinedBytes.slice(combinedBytes.length - tagLen)
  const decipher = forge.cipher.createDecipher('AES-GCM', forge.util.createBuffer(toForgeBin(keyBytes)))
  decipher.start({ iv: forge.util.createBuffer(toForgeBin(ivBytes)), tag: forge.util.createBuffer(toForgeBin(tag)) })
  decipher.update(forge.util.createBuffer(toForgeBin(ct)))
  if (!decipher.finish()) throw new Error('AES-GCM decryption failed (bad tag)')
  return fromForgeBin(decipher.output.getBytes())
}

// ─── Password hashing ─────────────────────────────────────────────────────────

// Fixed 16-byte salt for auth hashing. ASCII: "OpenNeutronAuth1"
const AUTH_SALT = new Uint8Array([
  0x4f, 0x70, 0x65, 0x6e, 0x4e, 0x65, 0x75, 0x74,
  0x72, 0x6f, 0x6e, 0x41, 0x75, 0x74, 0x68, 0x31,
])

export async function hashPassword(password) {
  const enc = new TextEncoder()
  return bcrypt({ password: enc.encode(password), salt: AUTH_SALT, costFactor: 10, outputType: 'encoded' })
}

// Derives 44 deterministic bytes (32 key + 12 IV) from password + serverSalt
async function deriveKeyMaterial(password, serverSalt) {
  const enc       = new TextEncoder()
  const saltBytes = hexToBytes(serverSalt)
  const bcryptOut = await bcrypt({ password: enc.encode(password), salt: saltBytes, costFactor: 10, outputType: 'binary' })
  return argon2id({ password: bcryptOut, salt: saltBytes, iterations: 3, memorySize: 65536, hashLength: 44, parallelism: 1, outputType: 'binary' })
}

// ─── Key generation ───────────────────────────────────────────────────────────

export async function generateKeyPair() {
  if (hasSubtleCrypto) {
    return crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 4096, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    )
  }
  // Forge fallback in a Web Worker so the UI doesn't freeze
  return new Promise((resolve, reject) => {
    const worker = new KeygenWorker()
    worker.onmessage = ({ data }) => {
      worker.terminate()
      if (data.error) { reject(new Error(data.error)); return }
      resolve({
        publicKey:  { _forge: true, key: forge.pki.publicKeyFromPem(data.pubPem) },
        privateKey: { _forge: true, key: forge.pki.privateKeyFromPem(data.privPem) },
      })
    }
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message || 'Worker failed')) }
    worker.postMessage('go')
  })
}

// ─── Key export / import ──────────────────────────────────────────────────────

export async function exportPublicKeyBase64(publicKey) {
  if (publicKey && publicKey._forge) {
    const der = forge.asn1.toDer(forge.pki.publicKeyToAsn1(publicKey.key)).getBytes()
    return btoa(der)
  }
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  return toB64(spki)
}

export async function encryptPrivateKey(privateKey, password, serverSalt) {
  const material  = await deriveKeyMaterial(password, serverSalt)
  const keyBytes  = material.slice(0, 32)
  const iv        = material.slice(32, 44)
  const pkcs8Bytes = (privateKey && privateKey._forge)
    ? forgePrivToPkcs8Bytes(privateKey.key)
    : new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey))

  if (hasSubtleCrypto && !(privateKey && privateKey._forge)) {
    const aesKey    = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt'])
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, pkcs8Bytes)
    return toB64(encrypted)
  }
  return toB64(forgeAesGcmEncrypt(keyBytes, iv, pkcs8Bytes))
}

export async function decryptPrivateKey(encryptedKey, password, serverSalt) {
  const material   = await deriveKeyMaterial(password, serverSalt)
  const keyBytes   = material.slice(0, 32)
  const iv         = material.slice(32, 44)
  const cipherData = fromB64(typeof encryptedKey === 'string' ? encryptedKey : encryptedKey.data)

  let pkcs8Bytes
  if (hasSubtleCrypto) {
    const aesKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt'])
    const plain  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, cipherData)
    pkcs8Bytes   = new Uint8Array(plain)
    return crypto.subtle.importKey('pkcs8', pkcs8Bytes, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt'])
  }
  pkcs8Bytes = forgeAesGcmDecrypt(keyBytes, iv, cipherData)
  return { _forge: true, key: pkcs8BytesToForgePriv(pkcs8Bytes) }
}

export async function getPublicCryptoKeyFromPrivate(privateKey) {
  if (privateKey && privateKey._forge) {
    const pub = forge.pki.setRsaPublicKey(privateKey.key.n, privateKey.key.e)
    return { _forge: true, key: pub }
  }
  const jwk    = await crypto.subtle.exportKey('jwk', privateKey)
  const pubJwk = { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg, ext: true, key_ops: ['encrypt'] }
  return crypto.subtle.importKey('jwk', pubJwk, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])
}

export async function importPublicKeyBase64(base64) {
  if (!hasSubtleCrypto) {
    const asn1 = forge.asn1.fromDer(atob(base64))
    return { _forge: true, key: forge.pki.publicKeyFromAsn1(asn1) }
  }
  return crypto.subtle.importKey('spki', fromB64(base64), { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['encrypt'])
}

export async function hashPublicKey(publicKeyBase64) {
  if (!hasSubtleCrypto) {
    const md = forge.md.sha256.create()
    md.update(atob(publicKeyBase64))
    return btoa(md.digest().getBytes())
  }
  const hash = await crypto.subtle.digest('SHA-256', fromB64(publicKeyBase64))
  return toB64(hash)
}

export async function exportPublicKeyFromPrivate(privateKey) {
  const pubKey = await getPublicCryptoKeyFromPrivate(privateKey)
  return exportPublicKeyBase64(pubKey)
}

// ─── Email encryption / decryption ───────────────────────────────────────────

export async function encryptEmail(plaintext, publicKey) {
  const useForge = !hasSubtleCrypto || (publicKey && publicKey._forge)

  // Prefer crypto.getRandomValues when available (works even on HTTP)
  const getRandomBytes = (n) => {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      return crypto.getRandomValues(new Uint8Array(n))
    }
    const b = new Uint8Array(n)
    for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256)
    return b
  }

  const iv     = getRandomBytes(12)
  const aesRaw = getRandomBytes(32)
  const enc    = new TextEncoder()

  if (useForge) {
    const fKey     = publicKey._forge ? publicKey.key : null
    if (!fKey) throw new Error('incompatible key type for forge enc path')
    const aesCipher = forgeAesGcmEncrypt(aesRaw, iv, enc.encode(plaintext))
    const rsaCipher = fKey.encrypt(toForgeBin(aesRaw), 'RSA-OAEP', forgeOaepParams())
    const dataOut   = new Uint8Array(12 + aesCipher.length)
    dataOut.set(iv, 0)
    dataOut.set(aesCipher, 12)
    return { aes_encrypted: btoa(rsaCipher), data_encrypted: toB64(dataOut.buffer) }
  }

  const aesKey    = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['encrypt'])
  const aesCipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, enc.encode(plaintext))
  const rsaCipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, publicKey, aesRaw)
  const dataOut   = new Uint8Array(12 + aesCipher.byteLength)
  dataOut.set(iv, 0)
  dataOut.set(new Uint8Array(aesCipher), 12)
  return { aes_encrypted: toB64(rsaCipher), data_encrypted: toB64(dataOut.buffer) }
}

export async function decryptEmail(data, messageKey, privateKey) {
  if (!messageKey) {
    return new TextDecoder().decode(fromB64(data))
  }

  const useForge = !hasSubtleCrypto || (privateKey && privateKey._forge)

  if (useForge) {
    const fKey      = privateKey._forge ? privateKey.key : null
    if (!fKey) throw new Error('incompatible key type for forge dec path')
    const aesRawBin = fKey.decrypt(atob(messageKey), 'RSA-OAEP', forgeOaepParams())
    const aesRaw    = fromForgeBin(aesRawBin)
    const dataBuf   = fromB64(data)
    const iv        = dataBuf.slice(0, 12)
    const ciphertext = dataBuf.slice(12)
    const plain = forgeAesGcmDecrypt(aesRaw, iv, ciphertext)
    return new TextDecoder().decode(plain)
  }

  const aesRaw = await crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, fromB64(messageKey))
  const aesKey = await crypto.subtle.importKey('raw', aesRaw, { name: 'AES-GCM' }, false, ['decrypt'])
  const dataBuf    = fromB64(data)
  const iv         = dataBuf.slice(0, 12)
  const ciphertext = dataBuf.slice(12)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
  return new TextDecoder().decode(plain)
}
