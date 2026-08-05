const jwt = require('jsonwebtoken');

const authRequired = (req, res, next) => {
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
        console.error(
            'JWT_SECRET no está configurado en el backend'
        );

        return res.status(500).json({
            message:
                'La autenticación del servidor no está configurada.',
        });
    }

    try {
        const header =
            req.headers.authorization || '';

        const token = header.startsWith('Bearer ')
            ? header.slice(7)
            : null;

        if (!token) {
            return res.status(401).json({
                message: 'Token requerido.',
            });
        }

        const decoded = jwt.verify(
            token,
            jwtSecret
        );

        req.user = decoded;

        return next();
    } catch (error) {
        console.error(
            'Error verificando token:',
            error.message
        );

        return res.status(401).json({
            message:
                'Token inválido o expirado.',
        });
    }
};

module.exports = {
    authRequired,
};