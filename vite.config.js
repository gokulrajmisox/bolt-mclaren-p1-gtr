import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-zion-3d',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url && req.url.startsWith('/local-3d/')) {
            const fileName = req.url.replace('/local-3d/', '').split('?')[0];
            const filePath = path.join('D:\\zion-ev\\3d', decodeURIComponent(fileName));
            if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
              res.setHeader('Content-Type', 'model/gltf-binary');
              res.setHeader('Access-Control-Allow-Origin', '*');
              fs.createReadStream(filePath).pipe(res);
              return;
            }
          }
          next();
        });
      }
    }
  ],
  server: {
    port: 5173,
    host: true,
    open: true
  }
});
