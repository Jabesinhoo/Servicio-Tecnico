'use strict';
// Copy this file to backend/scripts. Run from the backend folder.
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
async function main(){
 if(process.argv.includes('--help')){console.log('Desde backend: node scripts/exportar-estructura.js\nLee backend/.env. Exporta SOLO estructura, sin registros, propietarios ni permisos. Requiere pg_dump instalado.');return;}
 const backend=path.resolve(__dirname,'..');
 require(path.join(backend,'node_modules/dotenv')).config({path:path.join(backend,'.env'),quiet:true});
 for(const key of ['DB_HOST','DB_USER','DB_NAME'])if(!process.env[key])throw new Error('Falta '+key+' en backend/.env');
 const {Client}=require(path.join(backend,'node_modules/pg'));
 const client=new Client({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||5432),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,connectionTimeoutMillis:10000});
 let major;try{await client.connect();const r=await client.query("SHOW server_version_num");major=Math.floor(Number(r.rows[0].server_version_num)/10000);}finally{await client.end().catch(()=>{});}
 const candidates=['pg_dump'];
 if(process.platform==='win32'){
  const base=path.join(process.env.ProgramFiles||'C:\\Program Files','PostgreSQL');
  if(fs.existsSync(base))for(const entry of fs.readdirSync(base).filter(n=>/^\d+$/.test(n)).sort((a,b)=>Number(a)-Number(b)))candidates.push(path.join(base,entry,'bin','pg_dump.exe'));
 }
 let binary;
 for(const name of candidates){const check=spawnSync(name,['--version'],{encoding:'utf8',windowsHide:true});const version=Number(check.stdout?.match(/PostgreSQL\)\s+(\d+)/)?.[1]);if(check.status===0&&version>=major){binary=name;if(version===major)break;}}
 if(!binary)throw new Error('Instala las herramientas de PostgreSQL '+major+' o posterior (pg_dump). No se exportó ningún archivo.');
 const stamp=new Date().toISOString().replace(/[:.]/g,'-');
 const output=path.join(backend,'estructura-produccion-'+stamp+'.sql'),temp=output+'.partial';
 const args=['--schema-only','--no-owner','--no-privileges','--format=plain','--host',process.env.DB_HOST,'--port',String(process.env.DB_PORT||5432),'--username',process.env.DB_USER,'--dbname',process.env.DB_NAME,'--no-password','--file',temp];
 const result=spawnSync(binary,args,{encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,PGPASSWORD:process.env.DB_PASSWORD||'',PGCONNECT_TIMEOUT:'10'}});
 if(result.error||result.status!==0){fs.rmSync(temp,{force:true});throw new Error('pg_dump no pudo exportar. Revisa conexión y compatibilidad de versiones. Código: '+(result.error?.code||result.status));}
 const sql=fs.readFileSync(temp,'utf8');
 if(!sql.trim()||/^COPY\s.+FROM stdin;|^SELECT pg_catalog\.setval\(/m.test(sql)){fs.rmSync(temp,{force:true});throw new Error('La exportación no superó la comprobación de estructura sin datos.');}
 fs.renameSync(temp,output);
 console.log('OK: estructura exportada SIN registros. PostgreSQL local: '+major+'.');console.log('Archivo: '+output);
 console.log('No se exportaron usuarios, contraseñas, clientes, inventario, servicios ni facturas como registros.');
 console.log('El VPS debe usar una versión compatible. No importes sobre una base existente: primero revisaremos su estado.');
}
main().catch(e=>{console.error('ERROR:',e.message);process.exitCode=1;});
