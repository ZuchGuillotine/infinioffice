import React from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './styles/globals.css'

console.log('main.jsx: Starting application initialization...')

const queryClient = new QueryClient()

console.log('main.jsx: Creating React root...')
const root = createRoot(document.getElementById('root'))

console.log('main.jsx: Rendering App component...')
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)

console.log('main.jsx: Application initialization complete')


