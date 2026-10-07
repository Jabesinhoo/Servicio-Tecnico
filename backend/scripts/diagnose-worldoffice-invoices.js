'use strict';
const fs=require('fs'),path=require('path');
process.chdir(path.resolve(__dirname,'..'));
require('dotenv').config({quiet:true});
// This explicit diagnostic reads SQL Server catalog metadata only.
// It does not change .env, mappings, invoices, or financial clearance.
process.env.WORLDOFFICE_FINANCIAL_READONLY_ENABLED='true';
const{catalogSnapshot}=require('../src/services/worldoffice-financial-readonly.service');
(async()=>{try{const result=await catalogSnapshot();const report={generated_at:new Date().toISOString(),scope:'SQL Server catalog metadata only; no invoice rows',...result};const output=path.resolve('worldoffice-invoices-schema.json');fs.writeFileSync(output,JSON.stringify(report,null,2),'utf8');console.log('OK: estructura de posibles tablas/vistas de facturación.');console.log('Objetos revisados: '+result.object_count+'; candidatos: '+result.candidate_count);console.log('Archivo: '+output);console.log('Comparte ese JSON para conectar la búsqueda a las columnas reales.');}catch(e){console.error('No se pudo leer la estructura de World Office. '+(e.code||'ERROR'));if(e.code==='WORLDOFFICE_CONFIG_INCOMPLETE')console.error('Comprueba SQLSERVER_HOST, SQLSERVER_DATABASE, SQLSERVER_USER y SQLSERVER_PASSWORD en backend/.env.');else console.error('Comprueba acceso a SQL Server y permisos de lectura del catálogo. No compartas contraseñas.');process.exitCode=1;}})();
