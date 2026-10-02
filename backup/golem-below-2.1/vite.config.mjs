import {defineConfig} from 'vite';
import {sites} from '@openai/sites-vite-plugin';
export default defineConfig({
 plugins:[sites()],
 publicDir:false,
 build:{outDir:'dist/server',emptyOutDir:true,ssr:'game/worker.js',rollupOptions:{output:{entryFileNames:'index.js'}},minify:true},
 ssr:{noExternal:true},
});
