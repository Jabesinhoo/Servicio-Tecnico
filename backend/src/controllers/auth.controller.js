const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Usuario = require("../models/Usuario");

const register = async (req, res) => {
  try {
    const {
      nombre1,
      nombre2,
      apellidos,
      usuario,
      cedula,
      email,
      celular,
      password,
    } = req.body;

    if (!nombre1 || !apellidos || !usuario || !cedula || !email || !password) {
      return res.status(400).json({ message: "Faltan campos obligatorios." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "La contraseña debe tener mínimo 6 caracteres." });
    }

    // Validar existencia
    const existe = await Usuario.findOne({
      where: {
        [require("sequelize").Op.or]: [{ usuario }, { email }, { cedula }],
      },
    });

    if (existe) {
      return res.status(409).json({
        message: "Usuario, correo o cédula ya están registrados.",
      });
    }

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    const nuevo = await Usuario.create({
      nombre1,
      nombre2: nombre2 || null,
      apellidos,
      usuario,
      cedula,
      email,
      celular: celular || null,
      password: hashed,
    });

    return res.status(201).json({
      message: "Registro exitoso.",
      user: {
        id: nuevo.id,
        usuario: nuevo.usuario,
        email: nuevo.email,
        rol: nuevo.rol,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier || !password) {
      return res.status(400).json({ message: "Completa todos los campos." });
    }

    // Buscar por usuario o email
    const user = await Usuario.findOne({
      where: {
        [require("sequelize").Op.or]: [{ usuario: identifier }, { email: identifier }],
      },
    });

    if (!user) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos." });
    }

    if (!user.activo) {
      return res.status(403).json({ message: "Usuario inactivo. Contacta al administrador." });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Usuario o contraseña incorrectos." });
    }

    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES || "7d" }
    );

    return res.json({
      message: "Login exitoso.",
      token,
      user: { id: user.id, usuario: user.usuario, email: user.email, rol: user.rol },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Error interno del servidor." });
  }
};

module.exports = { register, login };
