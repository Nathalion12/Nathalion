import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { ThemeProvider } from '@mui/material/styles'; // Import ThemeProvider
import CssBaseline from '@mui/material/CssBaseline';   // Import CssBaseline
import theme from './theme/theme';                   // Import your custom theme

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeProvider theme={theme}> {/* Wrap App with ThemeProvider */}
      <CssBaseline /> {/* Normalize CSS and apply background color from theme */}
      <App />
    </ThemeProvider>
  </React.StrictMode>
);

reportWebVitals();
