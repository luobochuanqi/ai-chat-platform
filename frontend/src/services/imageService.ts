import api from './api'

export const generateImage = (prompt: string) =>
  api.post('/images/generate', { prompt })

export const getGallery = () =>
  api.get('/images/gallery')

export const getMyImages = () =>
  api.get('/images/my')

export const likeImage = (imageId: number) =>
  api.post('/images/like', { image_id: imageId })

export const publishImage = (imageId: number) =>
  api.put(`/images/${imageId}/publish`)

export const unpublishImage = (imageId: number) =>
  api.put(`/images/${imageId}/unpublish`)

export const getAllImages = () =>
  api.get('/images/admin/all')
