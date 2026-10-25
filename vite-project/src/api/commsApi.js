import client, { unwrap } from './client'
import { pickParams } from '../utils/params'

export const commsApi = {
  announcements: (query) =>
    unwrap(client.get('/announcements', { params: pickParams(query, ['page', 'limit']) })),
  createAnnouncement: (body) => unwrap(client.post('/announcements', body)),
  notifications: (query) =>
    unwrap(client.get('/notifications', { params: pickParams(query, ['page', 'limit']) })),
  markRead: (id) => unwrap(client.post(`/notifications/${id}/read`, {})),
  auditLogs: (query) =>
    unwrap(client.get('/audit-logs', { params: pickParams(query, ['page', 'limit', 'from', 'to']) })),
}
