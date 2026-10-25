import client, { unwrap, unwrapBlob, triggerDownload } from './client'

export const payrollApi = {
  listRuns: () => unwrap(client.get('/payroll')),
  getRun: (id) => unwrap(client.get(`/payroll/${id}`)),
  generateDraft: (month) => unwrap(client.post('/payroll', { month })),
  finalize: (id) => unwrap(client.post(`/payroll/${id}/finalize`, {})),
  listPayslips: () => unwrap(client.get('/payslips')),
  getPayslip: (runId, employeeId) => unwrap(client.get(`/payslips/${runId}/${employeeId}`)),
  downloadPdf: async (runId, employeeId) => {
    const { blob, filename } = await unwrapBlob(
      client.get(`/payslips/${runId}/${employeeId}/pdf`, { responseType: 'blob' }),
      `payslip-${runId}.pdf`,
    )
    triggerDownload(blob, filename)
  },
}
