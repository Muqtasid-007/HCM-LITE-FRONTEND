import client, { unwrap } from './client'
import { pickParams } from '../utils/params'

const listKeys = ['page', 'limit', 'from', 'to', 'employeeId', 'departmentId']
const correctionKeys = ['page', 'limit', 'state', 'employeeId']

export const attendanceApi = {
  checkIn: () => unwrap(client.post('/attendance/check-in', {})),
  checkOut: () => unwrap(client.post('/attendance/check-out', {})),
  list: (query) => unwrap(client.get('/attendance', { params: pickParams(query, listKeys) })),
  reconcile: (body) => unwrap(client.post('/attendance/reconcile', body)),
  requestCorrection: (body) => unwrap(client.post('/attendance/corrections', body)),
  listCorrections: (query) =>
    unwrap(client.get('/attendance/corrections', { params: pickParams(query, correctionKeys) })),
  decideCorrection: (id, body) => unwrap(client.post(`/attendance/corrections/${id}/decision`, body)),
}
