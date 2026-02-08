import { createRoot } from 'react-dom/client'
import React from 'react';
import App from './App.jsx';
import '@mantine/core/styles.css'; // Important! Import Mantine CSS
import { MantineProvider, createTheme } from '@mantine/core';

const theme = createTheme({
  /** Put your mantine theme override here */
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </React.StrictMode>,
);