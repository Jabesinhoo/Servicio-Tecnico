const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const Usuario = require("../models/Usuario");

function signToken(user) {
  return jwt.sign(
    { sub: user.id, rol: user.rol },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || "7d" }
  );
}

async function register(req, res) {
  try {
    const {
      nombre1, nombre2, apellidos,
      usuario, cedula, email, celular,
      password
    } = req.body;

    if (!nombre1 || !apellidos || !usuario || !cedula || !email || !password) {
      return res.status(400).json({ message: "Faltan campos obligatorios." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "La contraseña debe tener mínimo 6 caracteres." });
    }

    const existsEmail = await Usuario.findOne({ where: { email } });
    if (existsEmail) return res.status(409).json({ message: "El correo ya está registrado." });

    const existsUser = await Usuario.findOne({ where: { usuario } });
    if (existsUser) return res.status(409).json({ message: "El usuario ya existe." });

    const existsCedula = await Usuario.findOne({ where: { cedula } });
    if (existsCedula) return res.status(409).json({ message: "La cédula ya está registrada." });

    const hash = await bcrypt.hash(password, 10);

    const nuevo = await Usuario.create({
      nombre1: nombre1.trim(),
      nombre2: nombre2?.trim() || null,
      apellidos: apellidos.trim(),
      usuario: usuario.trim(),
      cedula: cedula.trim(),
      email: email.trim().toLowerCase(),
      celular: celular?.trim() || null,
      password: hash,
    });

    return res.status(201).json({
      message: "Usuario creado",
      user: {
        id: nuevo.id,
        nombre1: nuevo.nombre1,
        nombre2: nuevo.nombre2,
        apellidos: nuevo.apellidos,
        usuario: nuevo.usuario,
        email: nuevo.email,
        rol: nuevo.rol,
      },
    });
  } catch (err) {
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Ya existe un usuario con esos datos." });
    }
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Error del servidor." });
  }
}

async function login(req, res) {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Faltan credenciales." });
    }

    // Busca por usuario o email
    const user = await Usuario.findOne({
      where: {
        [Op.or]: [
          { usuario: identifier.trim() },
          { email: identifier.trim().toLowerCase() },
        ],
      },
    });

    if (!user) return res.status(401).json({ message: "Credenciales inválidas." });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ message: "Credenciales inválidas." });

    if (user.activo === false) {
      return res.status(403).json({ message: "Usuario inactivo." });
    }

    const token = signToken(user);

    return res.json({
      token,
      user: {
        id: user.id,
        nombre1: user.nombre1,
        nombre2: user.nombre2,
        apellidos: user.apellidos,
        usuario: user.usuario,
        email: user.email,
        rol: user.rol,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Error del servidor." });
  }
}

module.exports = { register, login };
