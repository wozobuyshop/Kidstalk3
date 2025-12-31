import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Standard way to expose env variables in Vite define block for client-side usage
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || 'AIzaSyCSbjnTc-ycD2YKEwjHFXKWQBYRtie9TCI'),
  }
});