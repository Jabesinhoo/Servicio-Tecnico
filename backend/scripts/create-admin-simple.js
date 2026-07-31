const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: process.env.DB_HOST || 'postgres',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '1235',
    database: process.env.DB_NAME || 'tecnicos'
});

async function createAdmin() {
    try {
        console.log('🔄 Conectando a la base de datos...');
        
        const adminData = {
            id: 'bafac7df-65d7-40cd-b32b-8e7046c6f0ee',
            nombre1: 'Admin',
            nombre2: '',
            apellidos: 'Sistema',
            usuario: 'admin',
            cedula: '0000000000',
            email: 'admin@inventario.com',
            celular: '3000000000',
            password: await bcrypt.hash('Admin123!', 10),
            rol: 'admin',
            activo: true
        };

        const result = await pool.query(
            `INSERT INTO usuarios (id, nombre1, nombre2, apellidos, usuario, cedula, email, celular, password, rol, activo, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
             ON CONFLICT (usuario) DO UPDATE SET
                password = EXCLUDED.password,
                rol = EXCLUDED.rol,
                activo = EXCLUDED.activo,
                updated_at = NOW()
             RETURNING id, usuario, email, rol`,
            [
                adminData.id,
                adminData.nombre1,
                adminData.nombre2,
                adminData.apellidos,
                adminData.usuario,
                adminData.cedula,
                adminData.email,
                adminData.celular,
                adminData.password,
                adminData.rol,
                adminData.activo
            ]
        );

        console.log('✅ Usuario admin creado/actualizado:');
        console.log(`   ID: ${result.rows[0].id}`);
        console.log(`   Usuario: ${result.rows[0].usuario}`);
        console.log(`   Email: ${result.rows[0].email}`);
        console.log(`   Rol: ${result.rows[0].rol}`);
        console.log(`   Contraseña: Admin123!`);
        
        await pool.end();
    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

createAdmin();
