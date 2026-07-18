import api from './api'

export const login = (username: string, password: string) =>
  api.post('/users/login', { username, password })

export const getMe = () =>
  api.get('/users/me')

export const getUsers = () =>
  api.get('/users/list')

export const createUser = (data: any) =>
  api.post('/users/create', data)

export const createUsersBulk = (users: any[]) =>
  api.post('/users/create-bulk', users)

export const updateUserQuota = (userId: number, data: any) =>
  api.put(`/users/${userId}/quota`, data)

export const toggleUser = (userId: number) =>
  api.put(`/users/${userId}/toggle`)

export const deleteUser = (userId: number) =>
  api.delete(`/users/${userId}`)
