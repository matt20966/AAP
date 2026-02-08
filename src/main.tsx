import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // This imports your AuthApp component
import './index.css';    // This ensures Tailwind CSS works

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);