import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './DatabaseTools';
import PasswordProtect from './PasswordProtect';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <PasswordProtect>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </PasswordProtect>
  </React.StrictMode>
);