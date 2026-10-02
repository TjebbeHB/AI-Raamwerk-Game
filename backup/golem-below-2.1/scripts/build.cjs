const {build}=require('esbuild');
const fs=require('node:fs');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
async function main(){
 await build({entryPoints:['client/entry.js'],bundle:true,outfile:'public/game.bundle.js',minify:true,target:['es2022'],logLevel:'info'});
 if(process.argv.includes('--client'))return;
 fs.rmSync('dist',{recursive:true,force:true});
 execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit'});
 fs.mkdirSync('dist/client',{recursive:true});
 // The original workshop remains available locally with its original server.
 for(const file of ['index.html','game.css','framework.css','game.bundle.js'])fs.copyFileSync(path.join('public',file),path.join('dist/client',file));
 fs.writeFileSync('dist/server/package.json','{"type":"module"}\n');
}
main().catch(e=>{console.error(e);process.exitCode=1});
