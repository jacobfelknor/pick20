import { createRoot } from 'react-dom/client'
import React from 'react';
import App from './App.jsx';
import '@mantine/core/styles.css'; // Important! Import Mantine CSS
import { MantineProvider, createTheme } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const theme = createTheme({
  /** Put your mantine theme override here */
});

// Create a client
const queryClient = new QueryClient();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <App />
      </MantineProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);