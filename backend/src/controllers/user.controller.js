// backend/src/controllers/user.controller.js
const db = require('../models');
const { Usuario, sequelize } = db;
const Role = sequelize.models.Role || db.Role;
const bcrypt = require('bcryptjs');
const { Op, QueryTypes } = require('sequelize');
// ============================================================
// OBTENER TODOS LOS USUARIOS
// ============================================================
// ============================================================
// OBTENER TODOS LOS USUARIOS + FILTROS
// ============================================================

const getUsers = async (req, res) => {
  try {
    const {
      rol,
      role_id,
      activo,
      search,
      q,
    } = req.query;

    const where = {};

    // ============================================================
    // FILTRO POR ROL
    // ============================================================

    if (rol && String(rol).trim()) {
      where.rol = String(rol)
        .trim()
        .toLowerCase();
    }

    // También permitir filtrar directamente por role_id.
    if (
      role_id !== undefined &&
      role_id !== null &&
      String(role_id).trim() !== ''
    ) {
      const parsedRoleId = Number(role_id);

      if (
        !Number.isInteger(parsedRoleId) ||
        parsedRoleId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: 'El role_id no es válido',
        });
      }

      where.role_id = parsedRoleId;
    }

    // ============================================================
    // FILTRO ACTIVO / INACTIVO
    // ============================================================

    if (
      activo !== undefined &&
      activo !== null &&
      String(activo).trim() !== ''
    ) {
      const activoNormalizado = String(activo)
        .trim()
        .toLowerCase();

      if (
        ![
          'true',
          'false',
          '1',
          '0',
        ].includes(activoNormalizado)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'El filtro activo debe ser true o false',
        });
      }

      where.activo =
        activoNormalizado === 'true' ||
        activoNormalizado === '1';
    }

    // ============================================================
    // BÚSQUEDA
    // ============================================================

    const termino = String(
      search || q || ''
    ).trim();

    if (termino) {
      where[Op.or] = [
        {
          nombre1: {
            [Op.iLike]: `%${termino}%`,
          },
        },
        {
          nombre2: {
            [Op.iLike]: `%${termino}%`,
          },
        },
        {
          apellidos: {
            [Op.iLike]: `%${termino}%`,
          },
        },
        {
          usuario: {
            [Op.iLike]: `%${termino}%`,
          },
        },
        {
          email: {
            [Op.iLike]: `%${termino}%`,
          },
        },
        {
          cedula: {
            [Op.iLike]: `%${termino}%`,
          },
        },
        {
          celular: {
            [Op.iLike]: `%${termino}%`,
          },
        },
      ];
    }

    // ============================================================
    // CONSULTA
    // ============================================================

    const users = await Usuario.findAll({
      where,

      include: [
        {
          model: Role,
          as: 'role',
          include: ['permissions'],
        },
      ],

      attributes: {
        exclude: [
          'password',
          'two_factor_secret',
        ],
      },

      order: [
        ['nombre1', 'ASC'],
        ['apellidos', 'ASC'],
      ],
    });

    // ============================================================
    // RESPUESTA
    // ============================================================

    const formattedUsers = users.map(
      (user) => ({
        ...user.toJSON(),

        nombre_completo:
          user.getNombreCompleto(),
      })
    );

    return res.json({
      success: true,
      data: formattedUsers,
      total: formattedUsers.length,

      filters: {
        rol: rol || null,
        role_id: role_id || null,
        activo:
          activo !== undefined
            ? activo
            : null,
        search: termino || null,
      },
    });
  } catch (error) {
    console.error(
      'Error al obtener usuarios:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        'Error al obtener usuarios',
      error:
        process.env.NODE_ENV ===
        'development'
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// OBTENER USUARIO POR ID
// ============================================================
const getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await Usuario.findByPk(id, {
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password', 'two_factor_secret'] },
    });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    res.json({
      success: true,
      data: {
        ...user.toJSON(),
        nombre_completo: user.getNombreCompleto(),
      },
    });
  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario',
      error: error.message,
    });
  }
};

// ============================================================
// CREAR USUARIO
// ============================================================
const createUser = async (req, res) => {
  try {
    const {
      nombre1,
      nombre2,
      apellidos,
      email,
      password,
      usuario,
      cedula,
      celular,
      role_id,
    } = req.body;

    // ============================================================
    // VALIDACIONES BÃSICAS
    // ============================================================

    if (!nombre1?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre es requerido',
      });
    }

    if (!apellidos?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Los apellidos son requeridos',
      });
    }

    if (!email?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El correo electrÃ³nico es requerido',
      });
    }

    if (!usuario?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de usuario es requerido',
      });
    }

    if (!cedula?.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: 'La cÃ©dula es requerida',
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La contraseÃ±a debe tener al menos 8 caracteres',
      });
    }

    if (!role_id) {
      return res.status(400).json({
        success: false,
        message: 'Debes seleccionar un rol',
      });
    }

    // ============================================================
    // NORMALIZAR
    // ============================================================

    const emailNormalizado =
      email.trim().toLowerCase();

    const usuarioNormalizado =
      usuario.trim().toLowerCase();

    const cedulaNormalizada =
      cedula.toString().trim();

    // ============================================================
    // VALIDAR ROL
    // El navegador NO decide el nombre del rol.
    // ============================================================

    const role = await Role.findOne({
      where: {
        id: role_id,
        active: true,
      },
    });

    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'El rol seleccionado no existe o estÃ¡ inactivo',
      });
    }

    // ============================================================
    // VALIDAR DUPLICADOS
    // ============================================================

    const [duplicados] = await sequelize.query(
      `
        SELECT
          id,
          email,
          usuario,
          cedula
        FROM usuarios
        WHERE
          LOWER(COALESCE(email, '')) = LOWER(:email)
          OR LOWER(COALESCE(usuario, '')) = LOWER(:usuario)
          OR cedula = :cedula
        LIMIT 1
      `,
      {
        replacements: {
          email: emailNormalizado,
          usuario: usuarioNormalizado,
          cedula: cedulaNormalizada,
        },
      }
    );

    if (duplicados.length > 0) {
      const existente = duplicados[0];

      if (
        existente.email?.toLowerCase() ===
        emailNormalizado
      ) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe una cuenta con ese correo electrÃ³nico',
        });
      }

      if (
        existente.usuario?.toLowerCase() ===
        usuarioNormalizado
      ) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe una cuenta con ese nombre de usuario',
        });
      }

      if (
        existente.cedula ===
        cedulaNormalizada
      ) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe una cuenta con esa cÃ©dula',
        });
      }

      return res.status(409).json({
        success: false,
        message: 'El usuario ya existe',
      });
    }

    // ============================================================
    // HASH CONTRASEÃ‘A
    // ============================================================

    const hashedPassword =
      await bcrypt.hash(password, 12);

    // ============================================================
    // CREAR USUARIO
    // ============================================================

    const user = await sequelize.transaction(
      async (transaction) => {
        return Usuario.create(
          {
            nombre1: nombre1.trim(),
            nombre2:
              nombre2?.trim() || null,

            apellidos:
              apellidos.trim(),

            email:
              emailNormalizado,

            usuario:
              usuarioNormalizado,

            cedula:
              cedulaNormalizada,

            celular:
              celular?.toString().trim() || null,

            password:
              hashedPassword,

            // Fuente oficial
            role_id:
              role.id,

            // Compatibilidad con cÃ³digo antiguo
            rol:
              role.name,

            activo:
              true,

            password_changed_at:
              new Date(),
          },
          {
            transaction,
          }
        );
      }
    );

    // ============================================================
    // RESPUESTA SEGURA
    // ============================================================

    const createdUser =
      await Usuario.findByPk(
        user.id,
        {
          include: [
            {
              model: Role,
              as: 'role',
              include: ['permissions'],
            },
          ],

          attributes: {
            exclude: [
              'password',
              'two_factor_secret',
            ],
          },
        }
      );

    return res.status(201).json({
      success: true,

      data: {
        ...createdUser.toJSON(),

        nombre_completo:
          createdUser.getNombreCompleto(),
      },

      message:
        role.name === 'tecnico'
          ? 'Cuenta de tÃ©cnico creada exitosamente'
          : 'Usuario creado exitosamente',
    });

  } catch (error) {
    console.error(
      'Error al crear usuario:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
    });
  }
};
// ============================================================
// ACTUALIZAR USUARIO
// ============================================================
const updateUser = async (req, res) => {
  const t = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const { 
      nombre1, nombre2, apellidos, email, password, 
      usuario, cedula, celular, role_id, rol, activo 
    } = req.body;
    
    const user = await Usuario.findByPk(id, { transaction: t });
    
    if (!user) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    // Verificar si el email ya existe (excepto el mismo usuario)
    if (email && email !== user.email) {
      const existingUser = await Usuario.findOne({
        where: { email },
        transaction: t,
      });
      
      if (existingUser) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con ese email',
        });
      }
    }
    
    // Verificar si el usuario ya existe
    if (usuario && usuario !== user.usuario) {
      const existingUsuario = await Usuario.findOne({
        where: { usuario },
        transaction: t,
      });
      
      if (existingUsuario) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con ese nombre de usuario',
        });
      }
    }
    
    // Verificar si la cÃ©dula ya existe
    if (cedula && cedula !== user.cedula) {
      const existingCedula = await Usuario.findOne({
        where: { cedula },
        transaction: t,
      });
      
      if (existingCedula) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con esa cÃ©dula',
        });
      }
    }
    
    // Verificar que el rol existe si se proporciona
    let roleId = role_id;
    let roleName = rol;
    
    if (roleId) {
      const role = await Role.findByPk(roleId, { transaction: t });
      if (!role) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Rol no encontrado',
        });
      }
      roleName = role.name;
    }
    
    // Preparar datos para actualizar
    const updateData = {
      nombre1: nombre1 !== undefined ? nombre1 : user.nombre1,
      nombre2: nombre2 !== undefined ? nombre2 : user.nombre2,
      apellidos: apellidos !== undefined ? apellidos : user.apellidos,
      email: email || user.email,
      usuario: usuario !== undefined ? usuario : user.usuario,
      cedula: cedula !== undefined ? cedula : user.cedula,
      celular: celular !== undefined ? celular : user.celular,
      role_id: roleId !== undefined ? roleId : user.role_id,
      rol: roleName || user.rol,
      activo: activo !== undefined ? activo : user.activo,
    };
    
    // Si se proporciona contraseÃ±a, hashearla
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
      updateData.password_changed_at = new Date();
    }
    
    await user.update(updateData, { transaction: t });
    await t.commit();
    
    // Obtener usuario actualizado con su rol
    const updatedUser = await Usuario.findByPk(id, {
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password', 'two_factor_secret'] },
    });
    
    res.json({
      success: true,
      data: {
        ...updatedUser.toJSON(),
        nombre_completo: updatedUser.getNombreCompleto(),
      },
      message: 'Usuario actualizado exitosamente',
    });
  } catch (error) {
    await t.rollback();
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message,
    });
  }
};

// ============================================================
// ELIMINAR USUARIO (SOFT DELETE)
// ============================================================
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await Usuario.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    // No permitir eliminar al propio usuario
    if (user.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'No puedes eliminarte a ti mismo',
      });
    }
    
    await user.update({ activo: false });
    
    res.json({
      success: true,
      message: 'Usuario desactivado exitosamente',
    });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar usuario',
      error: error.message,
    });
  }
};

// ============================================================
// ASIGNAR ROL A USUARIO
// ============================================================
const assignRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id } = req.body;
    
    if (!role_id) {
      return res.status(400).json({
        success: false,
        message: 'El ID del rol es requerido',
      });
    }
    
    const user = await Usuario.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }
    
    const role = await Role.findByPk(role_id);
    
    if (!role) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }
    
    await user.update({ 
      role_id, 
      rol: role.name 
    });
    
    // Obtener usuario actualizado
    const updatedUser = await Usuario.findByPk(id, {
      include: [{
        model: Role,
        as: 'role',
        include: ['permissions'],
      }],
      attributes: { exclude: ['password', 'two_factor_secret'] },
    });
    
    res.json({
      success: true,
      data: {
        ...updatedUser.toJSON(),
        nombre_completo: updatedUser.getNombreCompleto(),
      },
      message: 'Rol asignado exitosamente',
    });
  } catch (error) {
    console.error('Error al asignar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar rol',
      error: error.message,
    });
  }
};

// ============================================================
// OBTENER USUARIOS POR ROL
// ============================================================
const getUsersByRole = async (req, res) => {
  try {
    const { roleName } = req.params;
    
    if (!roleName) {
      return res.status(400).json({
        success: false,
        message: 'El nombre del rol es requerido',
      });
    }
    
    const users = await Usuario.findByRole(roleName);
    
    res.json({
      success: true,
      data: users.map(user => ({
        ...user.toJSON(),
        nombre_completo: user.getNombreCompleto(),
      })),
    });
  } catch (error) {
    console.error('Error al obtener usuarios por rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios por rol',
      error: error.message,
    });
  }
};

// ============================================================
// CAMBIAR PROPIA CONTRASEÑA
// ============================================================
const changeOwnPassword = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      });
    }

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña actual y la nueva contraseña son requeridas',
      });
    }

    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 8 caracteres',
      });
    }

    const user = await Usuario.findByPk(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    const validPassword = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña actual es incorrecta',
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe ser diferente a la actual',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await user.update({
      password: hashedPassword,
      password_changed_at: new Date(),
      failed_attempts: 0,
      locked_until: null,
    });

    return res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    console.error('Error cambiando propia contraseña:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al cambiar la contraseña',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// RESTABLECER CONTRASEÑA POR ADMINISTRADOR
// ============================================================
const resetPasswordByAdmin = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { id: targetUserId } = req.params;
    const { newPassword } = req.body;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      });
    }

    // Segunda barrera de seguridad: además del middleware de permisos,
    // esta operación exige que la cuenta autenticada sea realmente admin.
    const admin = await Usuario.findByPk(adminId, {
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'active'],
        },
      ],
      attributes: ['id', 'rol', 'role_id', 'activo'],
    });

    if (!admin || admin.activo === false) {
      return res.status(401).json({
        success: false,
        message: 'Administrador no encontrado o inactivo',
      });
    }

    const adminRole = String(
      admin.role?.name || admin.rol || ''
    )
      .trim()
      .toLowerCase();

    if (adminRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message:
          'Solo un administrador puede restablecer contraseñas de otros usuarios',
      });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña es requerida',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'La nueva contraseña debe tener al menos 8 caracteres',
      });
    }

    const targetUser = await Usuario.findByPk(targetUserId);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      targetUser.password
    );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message:
          'La nueva contraseña debe ser diferente a la contraseña actual',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const changedAt = new Date();

    await targetUser.update({
      password: hashedPassword,
      password_changed_at: changedAt,
      failed_attempts: 0,
      locked_until: null,
    });

    return res.json({
      success: true,
      message: 'Contraseña restablecida exitosamente',
      data: {
        user_id: targetUser.id,
        password_changed_at: changedAt,
      },
    });
  } catch (error) {
    console.error('Error restableciendo contraseña:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al restablecer la contraseña',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// FICHA ADMINISTRATIVA + HISTORIAL DE ACCESOS
// ============================================================
const getUserActivity = async (req, res) => {
  try {
    const adminId = req.user?.id;
    const { id: targetUserId } = req.params;

    const parsedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isInteger(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 25;

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado',
      });
    }

    // Esta ficha contiene información de seguridad y accesos.
    // Se restringe deliberadamente al rol admin, incluso si otro rol
    // recibe accidentalmente el permiso usuarios_view.
    const admin = await Usuario.findByPk(adminId, {
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'active'],
        },
      ],
      attributes: ['id', 'rol', 'role_id', 'activo'],
    });

    const adminRole = String(
      admin?.role?.name || admin?.rol || ''
    )
      .trim()
      .toLowerCase();

    if (!admin || admin.activo === false || adminRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message:
          'Solo un administrador puede consultar la ficha de actividad de usuarios',
      });
    }

    const targetUser = await Usuario.findByPk(targetUserId, {
      include: [
        {
          model: Role,
          as: 'role',
          attributes: ['id', 'name', 'description', 'active'],
        },
      ],
      attributes: [
        'id',
        'nombre1',
        'nombre2',
        'apellidos',
        'usuario',
        'email',
        'cedula',
        'celular',
        'rol',
        'role_id',
        'activo',
        'last_login',
        'password_changed_at',
        'failed_attempts',
        'locked_until',
        'two_factor_enabled',
        'created_at',
        'updated_at',
      ],
    });

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    let loginEvents = [];

    try {
      loginEvents = await sequelize.query(
        `
          SELECT
            id,
            user_id,
            identifier,
            success,
            ip_address,
            user_agent,
            failure_reason,
            created_at
          FROM user_login_events
          WHERE user_id = :userId
          ORDER BY created_at DESC
          LIMIT :limit
        `,
        {
          replacements: {
            userId: targetUserId,
            limit,
          },
          type: QueryTypes.SELECT,
        }
      );
    } catch (error) {
      // Permite abrir la ficha incluso antes de aplicar el SQL de
      // user_login_events. Así el despliegue no deja Usuarios inutilizable.
      if (error?.original?.code !== '42P01' && error?.parent?.code !== '42P01') {
        throw error;
      }

      console.warn(
        'Tabla user_login_events aún no existe; se devuelve historial vacío.'
      );
    }

    return res.json({
      success: true,
      data: {
        user: {
          ...targetUser.toJSON(),
          nombre_completo: targetUser.getNombreCompleto(),
        },
        login_events: loginEvents,
        total_returned: loginEvents.length,
      },
    });
  } catch (error) {
    console.error('Error obteniendo ficha de actividad:', error);

    return res.status(500).json({
      success: false,
      message: 'Error al obtener la ficha de actividad del usuario',
      error:
        process.env.NODE_ENV === 'development'
          ? error.message
          : undefined,
    });
  }
};

// ============================================================
// EXPORTAR
// ============================================================
module.exports = {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  assignRole,
  getUsersByRole,
  getUserActivity,
  changeOwnPassword,
  resetPasswordByAdmin,
};

