import client, { unwrap } from './client'
import { pickParams } from '../utils/params'

export const orgApi = {
  getOrganization: () => unwrap(client.get('/organization')),
  updateOrganization: (body) => unwrap(client.put('/organization', body)),
  createUnit: (body) => unwrap(client.post('/organization/units', body)),
  patchUnit: (id, body) => unwrap(client.patch(`/organization/units/${id}`, body)),
  deleteUnit: (id) => unwrap(client.delete(`/organization/units/${id}`)),
  getUsers: (query) => unwrap(client.get('/users', { params: pickParams(query, ['page', 'limit', 'search']) })),
  createHr: (body) => unwrap(client.post('/users/hr', body)),
  resetUser: (id) => unwrap(client.post(`/users/${id}/reset`, {})),
  deactivateUser: (id) => unwrap(client.post(`/users/${id}/deactivate`, {})),
  activateUser: (id) => unwrap(client.post(`/users/${id}/activate`, {})),
  createHrProfile: (id, body) => unwrap(client.post(`/users/${id}/employee-profile`, body)),
}
