import client, { unwrap, unwrapBlob, triggerDownload } from './client'
import { pickParams } from '../utils/params'

const directoryKeys = ['page', 'limit', 'search', 'departmentId', 'designationId', 'status', 'sort']

export const employeeApi = {
  list: (query) => unwrap(client.get('/employees', { params: pickParams(query, directoryKeys) })),
  get: (id) => unwrap(client.get(`/employees/${id}`)),
  create: (body) => unwrap(client.post('/employees', body)),
  patch: (id, body) => unwrap(client.patch(`/employees/${id}`, body)),
  updateSalary: (id, body) => unwrap(client.put(`/employees/${id}/salary`, body)),
  importCsv: (body) => unwrap(client.post('/employees/import', body)),
  exportCsv: async (query) => {
    const { blob, filename } = await unwrapBlob(
      client.get('/employees/export', {
        params: pickParams(query, directoryKeys),
        responseType: 'blob',
      }),
      'employees.csv',
    )
    triggerDownload(blob, filename)
  },
}
