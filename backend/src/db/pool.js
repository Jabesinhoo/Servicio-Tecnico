const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// Bind the authenticated actor to every SQL statement, including transaction
// clients. Clear the setting for jobs without a request to prevent pool reuse
// from attributing background work to the previous user.
const {currentActor}=require('../context/request-actor');
const connect=pool.connect.bind(pool);
pool.connect=async function(){
  const client=await connect();
  if(!client.actorQueryInstalled){
    const query=client.query.bind(client);
    client.query=async function(sql,values){
      const text=typeof sql==='string'?sql:sql?.text||'';
      if(/^\s*(ROLLBACK|COMMIT)(?:\s|;|$)/i.test(text))return query(sql,values);
      await query("SELECT set_config('app.actor_id',$1,false)",[currentActor()]);
      return query(sql,values);
    };
    client.actorQueryInstalled=true;
  }
  return client;
};
pool.query=async function(sql,values){
  const client=await pool.connect();
  try{return await client.query(sql,values);}finally{client.release();}
};
module.exports = pool;
