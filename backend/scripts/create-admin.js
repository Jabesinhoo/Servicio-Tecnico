const path = require('path');
require('dotenv').config();

// Ajusta la ruta para que apunte a la carpeta raíz del backend
const db = require(path.join(__dirname, '..', 'models'));
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

async function createAdmin() {
    try {
        await db.sequelize.authenticate();
        console.log('✅ Conectado a la base de datos');

        const Usuario = db.Usuario;

        // Verificar si el modelo Usuario está disponible
        if (!Usuario) {
            console.error('❌ Modelo Usuario no encontrado');
            console.log('Modelos disponibles:', Object.keys(db));
            process.exit(1);
        }

        // Datos del admin
        const adminData = {
            nombre1: 'Administrador',
            nombre2: '',
            apellidos: 'Sistema',
            usuario: 'admin',
            cedula: '1234567890',
            email: 'admin@inventario.com',
            celular: '3000000000',
            password: 'Admin123!',
            rol: 'admin',
            activo: true
        };

        // Verificar si ya existe un admin
        const existingAdmin = await Usuario.findOne({
            where: {
                [Op.or]: [
                    { usuario: adminData.usuario },
                    { email: adminData.email },
                    { cedula: adminData.cedula }
                ]
            }
        });

        if (existingAdmin) {
            console.log('⚠️ Ya existe un usuario con estos datos:');
            console.log(`ID: ${existingAdmin.id}`);
            console.log(`Usuario: ${existingAdmin.usuario}`);
            console.log(`Email: ${existingAdmin.email}`);
            console.log(`Cédula: ${existingAdmin.cedula}`);
            console.log(`Rol: ${existingAdmin.rol}`);
            console.log(`Activo: ${existingAdmin.activo}`);
            
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            readline.question('¿Deseas actualizar la contraseña del admin? (s/n): ', async (answer) => {
                if (answer.toLowerCase() === 's') {
                    const hashed = await bcrypt.hash(adminData.password, 10);
                    await existingAdmin.update({ password: hashed });
                    console.log('✅ Contraseña actualizada exitosamente');
                    console.log('🔑 Nueva contraseña:', adminData.password);
                } else {
                    console.log('ℹ️ No se realizaron cambios');
                }
                readline.close();
                process.exit(0);
            });
            return;
        }

        // Si no existe, crear nuevo admin
        const hashed = await bcrypt.hash(adminData.password, 10);
        const admin = await Usuario.create({
            ...adminData,
            password: hashed
        });

        console.log('✅ Administrador creado exitosamente:');
        console.log(`ID: ${admin.id}`);
        console.log(`Usuario: ${admin.usuario}`);
        console.log(`Email: ${admin.email}`);
        console.log(`Cédula: ${admin.cedula}`);
        console.log(`Rol: ${admin.rol}`);
        console.log('🔑 Contraseña:', adminData.password);

        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.errors) {
            error.errors.forEach(err => {
                console.error(`  - ${err.message}`);
            });
        }
        process.exit(1);
    }
}

createAdmin();