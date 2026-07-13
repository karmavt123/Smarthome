import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { config } from '@fortawesome/fontawesome-svg-core';
import './index.css';
import App from './App';
import AuthProvider from './contexts/AuthContext';
import reportWebVitals from './reportWebVitals';

// FontAwesome auto-injects its own unlayered CSS (.svg-inline--fa { width: 1.25em })
// which beats any Tailwind @layer utility class regardless of specificity. Disable it
// so Tailwind's w-*/h-* classes control icon sizing app-wide.
config.autoAddCss = false;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
