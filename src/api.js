import axios from 'axios'
import { storage } from './storage'
import { keySession } from './keySession'

const api = axios.create({
  //baseURL: 'http://openneutron.com:8080',
  //baseURL: 'http://localhost:8080/api',
  baseURL: '/api/',
  headers: {
    'Content-Type': 'application/json',
  },
  transformResponse: [
    (data) => {
      if (typeof data !== 'string') return data
      try {
        return JSON.parse(data.replace(/([,:\[]\s*)(\d{16,})/g, '$1"$2"'))
      } catch {
        return data
      }
    },
  ],
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && !err?.config?.url?.includes('/auth/')) {
      keySession.clear()
      storage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)

export const getUser = async () => {
  const token = storage.getToken()
  if (!token) return null
  try {
    const response = await api.get('/user/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    return response.data
  } catch (error) {
    return null
  }
}

export const adminGetUsers = async () => {
  const token = storage.getToken()
  const response = await api.get('/admin/users', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const adminCreateUser = async (username) => {
  const token = storage.getToken()
  const response = await api.post('/admin/users', { username }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const adminDeleteUser = async (username) => {
  const token = storage.getToken()
  const response = await api.delete('/admin/users', {
    data: { username },
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const adminSetAdminStatus = async (username, isAdmin) => {
  const token = storage.getToken()
  const response = await api.post('/admin/users/admin', { username, is_admin: isAdmin }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const adminSetCredentials = async (username, passwordHash, publicKey, encryptedPrivateKey) => {
  const token = storage.getToken()
  const response = await api.post('/admin/users/credentials', {
    username,
    password: passwordHash,
    public_key: publicKey,
    encrypted_private_key: encryptedPrivateKey,
  }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const userSetCredentials = async (passwordHash, publicKey, encryptedPrivateKey) => {
  const token = storage.getToken()
  const response = await api.post('/user/credentials', {
    password: passwordHash,
    public_key: publicKey,
    encrypted_private_key: encryptedPrivateKey,
  }, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data
}

export const emailListAll = async () => {
  const token = storage.getToken()
  const response = await api.post('/email/list', null, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return response.data.uids ?? []
}

export const emailGetRaw = async (uid) => {
  const token = storage.getToken()
  const response = await api.post('/email/get', `{"uid":${uid}}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  return { data: response.data.data, message_key: response.data.message_key }
}

export const emailSetRaw = async (uid, data, messageKey) => {
  const token = storage.getToken()
  const bodyStr = messageKey
    ? `{"uid":${uid},"data":"${data}","message_key":"${messageKey}"}`
    : `{"uid":${uid},"data":"${data}"}`
  const response = await api.post('/email/set', bodyStr, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  return response.data
}

export default api