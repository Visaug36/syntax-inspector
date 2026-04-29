import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Served at https://<user>.github.io/syntax-inspector/ — Pages serves under
// the repo path, so assets must resolve relative to that subpath. Vite dev
// keeps `/` so local hot-reload works unchanged.
const isProd = process.env.NODE_ENV === 'production' || process.env.GITHUB_ACTIONS === 'true'

export default defineConfig({
  base: isProd ? '/syntax-inspector/' : '/',
  plugins: [react()],
  // ES-module workers so the worker can lazy-import language checkers via
  // dynamic import(). IIFE (Vite's default) doesn't support code splitting.
  worker: { format: 'es' },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@babel/parser', 'css-tree', 'js-yaml'],
  },
  resolve: {
    alias: {
      // node-sql-parser and a few other deps reference Node-only modules
      // (path, fs) in code paths the browser never reaches. Point to an
      // empty stub so the bundler doesn't try to resolve them.
      path: new URL('./src/_empty-stub.js', import.meta.url).pathname,
      fs:   new URL('./src/_empty-stub.js', import.meta.url).pathname,
    },
  },
})
