import client, { unwrap } from './client'
import { pickParams } from '../utils/params'

const listKeys = ['page', 'limit', 'state', 'from', 'to', 'employeeId', 'departmentId']

export const leaveApi = {
  list: (query) => unwrap(client.get('/leaves', { params: pickParams(query, listKeys) })),
  apply: (body) => unwrap(client.post('/leaves', body)),
  balances: (id, year) => unwrap(client.get(`/leaves/balances/${id}`, { params: { year } })),
  cancel: (id) => unwrap(client.post(`/leaves/${id}/cancel`, {})),
  decide: (id, body) => unwrap(client.post(`/leaves/${id}/decision`, body)),
}
