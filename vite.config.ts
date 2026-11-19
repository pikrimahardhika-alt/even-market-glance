import { defineConfig } from 'vite'
import { createMarketApiHandler } from './server/market-api.mjs'

const marketApi = createMarketApiHandler()

export default defineConfig({
  plugins: [
    {
      name: 'market-glance-local-backend',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith('/api/')) return next()
          void marketApi(req, res, next)
        })
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    strictPort: true,
  },
})
