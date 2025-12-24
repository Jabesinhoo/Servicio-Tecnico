function allowRoles(...roles) {
  return (req, res, next) => {
    if (!req.user?.rol) return res.status(401).json({ message: "No autorizado." });
    if (!roles.includes(req.user.rol)) return res.status(403).json({ message: "Prohibido." });
    next();
  };
}

module.exports = { allowRoles };
