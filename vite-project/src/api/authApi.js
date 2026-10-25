import client, { unwrap } from './client'

export const authApi = {
  setupStatus: () => unwrap(client.get('/setup/status')),
  initialize: (body) => unwrap(client.post('/setup', body)),
  login: (body) => unwrap(client.post('/auth/login', body, { skipAuthRedirect: true })),
  me: () => unwrap(client.get('/auth/me')),
  logout: () => unwrap(client.post('/auth/logout', {})),
  changePassword: (body) => unwrap(client.post('/auth/change-password', body)),
}
