import client, { unwrap } from './client'

export const aiApi = {
  chat: (message) => unwrap(client.post('/ai/chat', { message }, { timeout: 15000 })),
  summary: (filters) => {
    const body = filters ? { filters } : {}
    return unwrap(client.post('/ai/summary', body, { timeout: 15000 }))
  },
  smartLeave: (message) => unwrap(client.post('/ai/smart-leave', { message }, { timeout: 15000 })),
}
