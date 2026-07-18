import api from './api'

export const getStats = () =>
  api.get('/admin/stats')

export const getUserSessions = (userId: number) =>
  api.get(`/admin/users/${userId}/sessions`)
