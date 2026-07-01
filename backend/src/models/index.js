'use strict';

const fs = require('fs');
const path = require('path');
const Sequelize = require('sequelize');
const process = require('process');
const basename = path.basename(__filename);
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.cjs')[env];
const db = {};

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

// Leer todos los archivos de la carpeta models
fs
  .readdirSync(__dirname)
  .filter(file => {
    return (
      file.indexOf('.') !== 0 &&
      file !== basename &&
      file.slice(-3) === '.js' &&
      file.indexOf('.test.js') === -1
    );
  })
  .forEach(file => {
    try {
      const modelPath = path.join(__dirname, file);
      const model = require(modelPath);
      
      // Si el modelo exporta una función, ejecútala
      if (typeof model === 'function') {
        const modelInstance = model(sequelize, Sequelize.DataTypes);
        db[modelInstance.name] = modelInstance;
        console.log(`✅ Modelo cargado: ${modelInstance.name}`);
      } else if (typeof model === 'object' && model !== null) {
        // Si es un objeto (como los modelos que usan sequelize.define directamente)
        if (model.name) {
          db[model.name] = model;
          console.log(`✅ Modelo cargado (objeto): ${model.name}`);
        } else {
          console.log(`⚠️ Modelo sin nombre: ${file}`);
        }
      } else {
        console.log(`⚠️ Modelo no reconocido: ${file}`);
      }
    } catch (error) {
      console.error(`❌ Error cargando modelo ${file}:`, error.message);
    }
  });

// Ejecutar asociaciones
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

// Verificar que los modelos de facturación están cargados
console.log('📋 Modelos cargados:', Object.keys(db).join(', '));

module.exports = db;