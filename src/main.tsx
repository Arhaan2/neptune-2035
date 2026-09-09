import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './ui/App';
import TwinApp from './ui/TwinApp';
import '../app/globals.css';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {new URLSearchParams(location.search).has('legacy') || location.hash.startsWith('#s=') ? <App /> : <TwinApp />}
  </React.StrictMode>,
);
