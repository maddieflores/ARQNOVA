import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes/router';
import { AuthProvider } from './modules/auth/AuthProvider';
import { ThemeProvider } from './modules/theme/ThemeContext';
import '@xyflow/react/dist/style.css';
import './assets/styles.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ThemeProvider><AuthProvider><RouterProvider router={router}/></AuthProvider></ThemeProvider></React.StrictMode>);
