import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './site.css';

const root = document.getElementById('root');
if (!root) throw new Error('The site entry found no #root to mount into');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
