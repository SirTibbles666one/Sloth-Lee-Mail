import forge from 'node-forge'

self.onmessage = () => {
  try {
    const kp = forge.pki.rsa.generateKeyPair({ bits: 4096, e: 0x10001 })
    const pubPem  = forge.pki.publicKeyToPem(kp.publicKey)
    const privPem = forge.pki.privateKeyToPem(kp.privateKey)
    self.postMessage({ pubPem, privPem })
  } catch (err) {
    self.postMessage({ error: err.message || 'Key generation failed' })
  }
}
