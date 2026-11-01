import { apiRequest, apiRequestBlob, apiUpload } from './authService'

export const profileService = {
  async getMine() { return apiRequest('/profile') },
  async getReadiness() { return apiRequest('/profile/readiness') },
  async update(details) { return apiRequest('/profile', { method: 'PUT', body: JSON.stringify(details) }) },
  async uploadProfilePhoto(file) {
    const form = new FormData()
    form.append('photo', file)
    return apiUpload('/profile/photo', form)
  },
  async removeProfilePhoto() { return apiRequest('/profile/photo', { method: 'DELETE' }) },
  photoUrl(path) { return path ? new URL(path, import.meta.env.VITE_API_URL || 'http://localhost:5000/api').toString() : '' },
  async uploadResume(file) {
    const form = new FormData()
    form.append('resume', file)
    return apiUpload('/profile/resume', form)
  },
  async removeResume() { return apiRequest('/profile/resume', { method: 'DELETE' }) },
  async downloadResume() { return apiRequestBlob('/profile/resume') },
  async downloadApplicationResume(applicationId) { return apiRequestBlob(`/applications/${applicationId}/resume`) },
}
