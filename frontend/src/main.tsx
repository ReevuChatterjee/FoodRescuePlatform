import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

if (import.meta.env.VITE_USE_MOCK_API === 'true') {
  import('./api/mock').then(() => {
    console.log('Mock API initialized in dev environment');
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
