import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

// Simple render without StrictMode for now
const rootElement = document.getElementById('root')
if (rootElement) {
  import('react-dom/client').then(({ createRoot }) => {
    const root = createRoot(rootElement)
    root.render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    )
  })
}
