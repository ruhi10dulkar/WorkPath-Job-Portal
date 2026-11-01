import { apiRequest } from './authService'

export const applicationService = {
  async apply(jobId, profileUpdatedAt) {
    const result = await apiRequest(`/applications/${jobId}`, { method: 'POST', body: JSON.stringify({ profileUpdatedAt }) })
    return result.application
  },

  async getMine() {
    const result = await apiRequest('/applications/my')
    return result.applications
  },

  async getForJob(jobId) {
    const result = await apiRequest(`/applications/job/${jobId}`)
    return result
  },

  async getById(applicationId) {
    const result = await apiRequest(`/applications/${applicationId}`)
    return result.application
  },

  async getForRecruiter(filters = {}) {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => { if (value !== '' && value !== undefined && value !== null) params.set(key, value) })
    const query = params.size ? `?${params}` : ''
    const result = await apiRequest(`/applications/recruiter${query}`)
    return result
  },

  async updateStatus(applicationId, status) {
    const result = await apiRequest(`/applications/${applicationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    })
    return result.application
  },

  async updateNotes(applicationId, notes) {
    const result = await apiRequest(`/applications/${applicationId}/notes`, { method: 'POST', body: JSON.stringify({ notes }) })
    return result.notes
  },
  async addNote(applicationId, text) {
    const result = await apiRequest(`/applications/${applicationId}/notes/add`, { method: 'POST', body: JSON.stringify({ text }) })
    return result.note
  },
  async editNote(applicationId, noteId, text) {
    const result = await apiRequest(`/applications/${applicationId}/notes/${noteId}`, { method: 'PATCH', body: JSON.stringify({ text }) })
    return result.note
  },
  async deleteNote(applicationId, noteId) {
    return apiRequest(`/applications/${applicationId}/notes/${noteId}`, { method: 'DELETE' })
  },
  async updateRound(applicationId, roundId, payload) {
    return apiRequest(`/applications/${applicationId}/recruitment/${roundId}`, { method: 'PATCH', body: JSON.stringify(payload) })
  },
}
