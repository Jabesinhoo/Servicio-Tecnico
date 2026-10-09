'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {creationAvailability}=require('../src/services/creation-availability.service');
const {chooseFreeSlot}=require('../src/domain/service-free-calendar');
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
async function check(busy=[]){const db={async query(sql){assert(!sql.includes('tecnicos_horarios'));if(sql.includes('FROM tipos_servicio'))return{rows:[{id:id(3),duracion_estimada:105}]};return{rows:busy};}};return creationAvailability(db,{date:'2026-10-08',time:'23:08',typeId:id(3),technicians:[id(1),id(2)]});}
test('Sin turnos personales el equipo puede reservar toda la duración, incluso cruzando medianoche',async()=>{const r=await check();assert.equal(r.available,true);assert.equal(r.duration,105);assert(r.technicians.every(t=>t.available));});
test('Una reserva de cualquier integrante bloquea la creación y muestra la OS',async()=>{const r=await check([{technician_id:id(2),codigo_os:'OS-2026-0018'}]);assert.equal(r.available,false);assert.equal(r.technicians[1].reason_code,'SCHEDULE_CONFLICT');assert.match(r.technicians[1].reason,/OS-2026-0018/);assert.equal(r.technicians[0].available,true);});
test('Programación automática reserva un intervalo común evitando cruces de ambos técnicos',()=>{const busy=[{technician_id:id(1),start_at:'2026-10-09T00:00Z',end_at:'2026-10-09T01:00Z'},{technician_id:id(2),start_at:'2026-10-09T01:30Z',end_at:'2026-10-09T02:00Z'},{technician_id:id(9),start_at:'2026-10-09T02:00Z',end_at:'2026-10-09T04:00Z'}];const r=chooseFreeSlot({start:'2026-10-09T00:00Z',duration:105,ids:[id(1),id(2)],busy});assert.equal(r.startAt,'2026-10-09T02:00:00.000Z');assert.equal(r.endAt,'2026-10-09T03:45:00.000Z');});
