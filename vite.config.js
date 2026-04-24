import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['acorn', '@babel/parser', 'css-tree', 'js-yaml'],
  },
  resolve: {
    alias: {
      // node-sql-parser references path in some code paths; stub it for browser
      path: false,
      fs: false,
    },
  },
})
