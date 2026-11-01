import { apiRequest } from './authService'

export const jobService = {
  async getJobs(filters = {}) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    const result = await apiRequest(`/jobs${query.size ? `?${query}` : ''}`)
    return result.jobs
  },

  async getJob(id) {
    const result = await apiRequest(`/jobs/${id}`)
    return result.job
  },

  async getMatch(id) {
    const result = await apiRequest(`/jobs/${id}/match`)
    return result.match
  },

  async getMyJobs() {
    const result = await apiRequest('/jobs/my')
    return result.jobs
  },

  async createJob(details) {
    const result = await apiRequest('/jobs', {
      method: 'POST',
      body: JSON.stringify(details),
    })
    return result.job
  },

  async updateJob(id, details) {
    const result = await apiRequest(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(details),
    })
    return result.job
  },

  async deleteJob(id) {
    return apiRequest(`/jobs/${id}`, { method: 'DELETE' })
  },
  async saveRecruitmentPipeline(id, rounds) {
    return apiRequest(`/jobs/${id}/recruitment-pipeline`, { method: 'PUT', body: JSON.stringify({ rounds }) })
  },
}
