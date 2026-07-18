import api from './api'

export const getSessions = () =>
  api.get('/chat/sessions')

export const createSession = (title?: string) =>
  api.post('/chat/sessions', null, { params: { title } })

export const getSession = (sessionId: number) =>
  api.get(`/chat/sessions/${sessionId}`)

export const updateSession = (sessionId: number, title: string) =>
  api.put(`/chat/sessions/${sessionId}`, null, { params: { title } })

export const deleteSession = (sessionId: number) =>
  api.delete(`/chat/sessions/${sessionId}`)

export const sendMessage = (sessionId: number, content: string) =>
  api.post(`/chat/sessions/${sessionId}/messages`, { content })
