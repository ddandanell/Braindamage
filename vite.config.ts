import path from 'path';
import { defineConfig, loadEnv } from 'vite';

// Manual chunk splitting to reduce initial bundle size
const manualChunks = {
  react: ['react', 'react-dom'],
  motion: ['framer-motion'],
  firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics'],
};

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              for (const key in manualChunks) {
                if (manualChunks[key].some(pkg => id.includes(pkg))) {
                  return key;
                }
              }
            }
          }
        }
      }
    };
});
