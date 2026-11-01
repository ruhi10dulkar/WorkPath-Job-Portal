import { apiRequest } from './authService'

export const dashboardService = {
  async getApplicant() {
    return apiRequest('/dashboard/applicant')
  },
  async getRecruiter() {
    return apiRequest('/dashboard/recruiter')
  },
}
