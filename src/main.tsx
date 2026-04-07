import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Apply saved theme before first render to avoid flash
try {
  const saved = localStorage.getItem('tenderspot_theme');
  if (saved !== 'light') {
    document.documentElement.classList.add('dark');
  }
} catch { /* ignore */ }

createRoot(document.getElementById("root")!).render(<App />);
