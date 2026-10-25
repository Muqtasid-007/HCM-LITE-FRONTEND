import client, { unwrap } from './client'
import { pickParams } from '../utils/params'

const dashKeys = ['from', 'to', 'departmentId']
const toolKeys = ['from', 'to', 'departmentId', 'search', 'year']

export const analyticsApi = {
  dashboard: (query) => unwrap(client.get('/dashboard', { params: pickParams(query, dashKeys) })),
  tool: (name, query) => unwrap(client.get(`/analytics/${name}`, { params: pickParams(query, toolKeys) })),
}
