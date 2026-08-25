'use strict';

require('dotenv').config();

const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const { Usuario, Role, sequelize } = require('../src/models');

const required = (name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`Falta la variable ${name}`);
  return value;
};

(async () => {
  let transaction;

  try {
    const nombre1 = required('EMERGENCY_ADMIN_NOMBRE');
    const apellidos = required('EMERGENCY_ADMIN_APELLIDOS');
    const usuario = required('EMERGENCY_ADMIN_USUARIO').toLowerCase();
    const email = required('EMERGENCY_ADMIN_EMAIL').toLowerCase();
    const cedula = required('EMERGENCY_ADMIN_CEDULA');
    const password = required('EMERGENCY_ADMIN_PASSWORD');
    const celular = String(process.env.EMERGENCY_ADMIN_CELULAR || '').trim() || null;

    if (password.length < 12) {
      throw new Error('La contraseña del administrador de emergencia debe tener mínimo 12 caracteres.');
    }

    transaction = await sequelize.transaction();

    const role = await Role.findOne({
      where: { name: 'admin', active: true },
      transaction,
    });

    if (!role) throw new Error('No existe un rol admin activo en la tabla roles.');

    const duplicate = await Usuario.findOne({
      where: { [Op.or]: [{ usuario }, { email }, { cedula }] },
      transaction,
    });

    if (duplicate) {
      throw new Error(`Ya existe un usuario con ese usuario, correo o cédula. ID: ${duplicate.id}`);
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await Usuario.create({
      nombre1,
      nombre2: null,
      apellidos,
      usuario,
      email,
      cedula,
      celular,
      password: hashedPassword,
      role_id: role.id,
      rol: role.name,
      activo: true,
      password_changed_at: new Date(),
      failed_attempts: 0,
      locked_until: null,
    }, { transaction });

    await transaction.commit();
    transaction = null;

    console.log('');
    console.log('ADMINISTRADOR DE EMERGENCIA CREADO');
    console.log(`ID: ${user.id}`);
    console.log(`Usuario: ${user.usuario}`);
    console.log(`Correo: ${user.email}`);
    console.log(`Rol: ${role.name}`);
    console.log('Estado: activo');
    console.log('La contraseña no se muestra por seguridad.');
  } catch (error) {
    if (transaction) {
      try { await transaction.rollback(); } catch (_) {}
    }
    console.error('ERROR:', error.message);
    process.exitCode = 1;
  } finally {
    try { await sequelize.close(); } catch (_) {}
  }
})();
