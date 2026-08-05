
const pool = require('../db/pool');
const {
    listClients,
    searchClients,
} = require('../services/client-query.service');

// backend/src/controllers/client.controller.js
exports.getAll = async (req, res) => {
    try {
        const result = await listClients({
            page: req.query.page,
            limit: req.query.limit,
            search:
                req.query.search ||
                req.query.q ||
                '',
            origin:
                req.query.origin ||
                req.query.origen ||
                'all',
        });

        /*
         * Compatibilidad temporal:
         *
         * El frontend actual espera un arreglo.
         * El frontend nuevo solicitará:
         * ?paginated=true
         */
        if (
            req.query.paginated !== 'true'
        ) {
            res.setHeader(
                'X-Total-Count',
                String(
                    result.pagination.total
                )
            );

            res.setHeader(
                'X-Total-Pages',
                String(
                    result.pagination.totalPages
                )
            );

            res.setHeader(
                'X-Current-Page',
                String(
                    result.pagination.page
                )
            );

            return res.status(200).json(
                result.data
            );
        }

        return res.status(200).json(
            result
        );
    } catch (error) {
        console.error(
            'Error obteniendo clientes:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Error al obtener los clientes',
            error: error.message,
        });
    }
};


exports.getById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT id, tipo_persona, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
             razon_social, tipo_documento, documento, digito_verificacion, telefono, telefono_2,
             email, email_2, direccion, direccion_2, ciudad, codigo_postal,
             responsable_iva, autoretenedor, gran_contribuyente, clasificacion_dian,
             actividad_economica, codigo_ciiu, plazo_credito, cupo_credito,
             fecha_aniversario, lista_precios, forma_pago, codigo_worldoffice,
             observacion, notas, activo, "createdAt", "updatedAt"
      FROM clients 
      WHERE id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting client:', error);
    res.status(500).json({ message: 'Error al obtener el cliente' });
  }
};

exports.search = async (req, res) => {
    try {
        const search =
            String(req.query.q || '')
                .trim();

        if (search.length < 2) {
            return res.status(200).json([]);
        }

        const result =
            await searchClients({
                search,

                limit:
                    req.query.limit || 20,

                origin:
                    req.query.origin ||
                    req.query.origen ||
                    'all',
            });

        /*
         * Conservamos el formato de arreglo porque
         * ServicioForm.jsx ya espera res.data.
         */
        return res.status(200).json(
            result.data
        );
    } catch (error) {
        console.error(
            'Error buscando clientes:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Error al buscar clientes',
            error: error.message,
        });
    }
};


exports.create = async (req, res) => {
  try {
    const {
      tipo_persona, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      razon_social, tipo_documento, documento, digito_verificacion,
      telefono, telefono_2, email, email_2, direccion, direccion_2, ciudad, codigo_postal,
      responsable_iva, autoretenedor, gran_contribuyente, clasificacion_dian,
      actividad_economica, codigo_ciiu, plazo_credito, cupo_credito,
      fecha_aniversario, lista_precios, forma_pago, codigo_worldoffice,
      observacion, notas, activo
    } = req.body;
    
    if (tipo_persona === 'natural') {
      if (!primer_nombre || !primer_apellido) {
        return res.status(400).json({ message: 'Nombre y apellido son requeridos para persona natural' });
      }
    } else {
      if (!razon_social || razon_social === '') {
        return res.status(400).json({ message: 'Razón social es requerida para persona jurídica' });
      }
    }
    
    if (!documento) {
      return res.status(400).json({ message: 'Número de documento es requerido' });
    }
    
    const fechaAniversarioValue = (fecha_aniversario && fecha_aniversario !== '') ? fecha_aniversario : null;
    
    const razonSocialValue = (tipo_persona === 'juridica' && razon_social && razon_social !== '') ? razon_social : null;
    
    const existing = await pool.query(`
      SELECT id FROM clients WHERE documento = $1
    `, [documento]);
    
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Ya existe un cliente con ese documento' });
    }
    
    const result = await pool.query(`
      INSERT INTO clients (
        id, tipo_persona, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
        razon_social, tipo_documento, documento, digito_verificacion,
        telefono, telefono_2, email, email_2, direccion, direccion_2, ciudad, codigo_postal,
        responsable_iva, autoretenedor, gran_contribuyente, clasificacion_dian,
        actividad_economica, codigo_ciiu, plazo_credito, cupo_credito,
        fecha_aniversario, lista_precios, forma_pago, codigo_worldoffice,
        observacion, notas, activo, "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32,
        NOW(), NOW()
      )
      RETURNING id, tipo_persona, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
                razon_social, tipo_documento, documento, telefono, email, direccion, ciudad, activo
    `, [
      tipo_persona, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      razonSocialValue, tipo_documento, documento, digito_verificacion,
      telefono, telefono_2, email, email_2, direccion, direccion_2, ciudad, codigo_postal,
      responsable_iva !== false, autoretenedor || false, gran_contribuyente || false, 
      clasificacion_dian || 'normal', actividad_economica, codigo_ciiu, plazo_credito || 0, 
      cupo_credito || 0, fechaAniversarioValue, lista_precios, forma_pago, codigo_worldoffice,
      observacion, notas, activo !== false
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ message: 'Error al crear el cliente: ' + error.message });
  }
};


exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tipo_persona, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      razon_social, tipo_documento, documento, digito_verificacion,
      telefono, telefono_2, email, email_2, direccion, direccion_2, ciudad, codigo_postal,
      responsable_iva, autoretenedor, gran_contribuyente, clasificacion_dian,
      actividad_economica, codigo_ciiu, plazo_credito, cupo_credito,
      fecha_aniversario, lista_precios, forma_pago, codigo_worldoffice,
      observacion, notas, activo
    } = req.body;
    
    
    let fechaAniversarioValue = null;
    if (fecha_aniversario && fecha_aniversario !== '') {
      fechaAniversarioValue = fecha_aniversario;
    }
    

    const razonSocialValue = (razon_social && razon_social !== '') ? razon_social : null;
    
    const result = await pool.query(`
      UPDATE clients 
      SET tipo_persona = COALESCE($1, tipo_persona),
          primer_nombre = COALESCE($2, primer_nombre),
          segundo_nombre = COALESCE($3, segundo_nombre),
          primer_apellido = COALESCE($4, primer_apellido),
          segundo_apellido = COALESCE($5, segundo_apellido),
          razon_social = $6,
          tipo_documento = COALESCE($7, tipo_documento),
          documento = COALESCE($8, documento),
          digito_verificacion = COALESCE($9, digito_verificacion),
          telefono = COALESCE($10, telefono),
          telefono_2 = COALESCE($11, telefono_2),
          email = COALESCE($12, email),
          email_2 = COALESCE($13, email_2),
          direccion = COALESCE($14, direccion),
          direccion_2 = COALESCE($15, direccion_2),
          ciudad = COALESCE($16, ciudad),
          codigo_postal = COALESCE($17, codigo_postal),
          responsable_iva = COALESCE($18, responsable_iva),
          autoretenedor = COALESCE($19, autoretenedor),
          gran_contribuyente = COALESCE($20, gran_contribuyente),
          clasificacion_dian = COALESCE($21, clasificacion_dian),
          actividad_economica = COALESCE($22, actividad_economica),
          codigo_ciiu = COALESCE($23, codigo_ciiu),
          plazo_credito = COALESCE($24, plazo_credito),
          cupo_credito = COALESCE($25, cupo_credito),
          fecha_aniversario = $26,
          lista_precios = COALESCE($27, lista_precios),
          forma_pago = COALESCE($28, forma_pago),
          codigo_worldoffice = COALESCE($29, codigo_worldoffice),
          observacion = COALESCE($30, observacion),
          notas = COALESCE($31, notas),
          activo = COALESCE($32, activo),
          "updatedAt" = NOW()
      WHERE id = $33
      RETURNING *
    `, [
      tipo_persona, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
      razonSocialValue, tipo_documento, documento, digito_verificacion,
      telefono, telefono_2, email, email_2, direccion, direccion_2, ciudad, codigo_postal,
      responsable_iva, autoretenedor, gran_contribuyente, clasificacion_dian,
      actividad_economica, codigo_ciiu, plazo_credito, cupo_credito,
      fechaAniversarioValue, lista_precios, forma_pago, codigo_worldoffice,
      observacion, notas, activo, id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ message: 'Error al actualizar el cliente: ' + error.message });
  }
};


exports.delete = async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            `
                UPDATE clients

                SET
                    activo = FALSE,
                    "updatedAt" = NOW()

                WHERE id = $1

                RETURNING
                    id,
                    tipo_persona,
                    razon_social,
                    primer_nombre,
                    primer_apellido
            `,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    'Cliente local no encontrado',
            });
        }

        const cliente =
            result.rows[0];

        const nombre =
            cliente.tipo_persona ===
            'juridica'
                ? cliente.razon_social
                : [
                    cliente.primer_nombre,
                    cliente.primer_apellido,
                ]
                    .filter(Boolean)
                    .join(' ');

        return res.status(200).json({
            success: true,
            message:
                `Cliente "${nombre}" desactivado correctamente`,
            deactivated: true,
        });
    } catch (error) {
        console.error(
            'Error desactivando cliente:',
            error
        );

        return res.status(500).json({
            success: false,
            message:
                'Error al desactivar el cliente',
            error: error.message,
        });
    }
};



exports.getClientStats = async (req, res) => {
  try {
    const { id } = req.params;
    
    const clientResult = await pool.query(`
      SELECT id, tipo_persona, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido,
             razon_social, tipo_documento, documento, telefono, email, direccion, ciudad, activo
      FROM clients WHERE id = $1
    `, [id]);
    
    if (clientResult.rows.length === 0) {
      return res.status(404).json({ message: 'Cliente no encontrado' });
    }
    
    const cliente = clientResult.rows[0];
    
    const totalServiciosResult = await pool.query(`
      SELECT COUNT(*)::int as total FROM service_orders WHERE client_id = $1
    `, [id]);
    
    const serviciosPorEstado = await pool.query(`
      SELECT estado, COUNT(*)::int as cantidad 
      FROM service_orders 
      WHERE client_id = $1 
      GROUP BY estado
    `, [id]);
    
    const serviciosPorMes = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YYYY') as mes,
        COUNT(*)::int as cantidad
      FROM service_orders 
      WHERE client_id = $1 
        AND "createdAt" >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt") DESC
      LIMIT 6
    `, [id]);
    
    const datosFinancieros = await pool.query(`
      SELECT 
        COALESCE(SUM(total_general), 0)::int as total_generado,
        COALESCE(AVG(total_general), 0)::int as promedio,
        COALESCE(MAX(total_general), 0)::int as maximo,
        COALESCE(MIN(total_general), 0)::int as minimo
      FROM service_orders 
      WHERE client_id = $1 AND estado = 'cerrada'
    `, [id]);
    
    const serviciosPendientes = await pool.query(`
      SELECT COUNT(*)::int as cantidad 
      FROM service_orders 
      WHERE client_id = $1 AND estado IN ('pendiente', 'asignada', 'en_ejecucion')
    `, [id]);
    
    const serviciosCompletados = await pool.query(`
      SELECT COUNT(*)::int as cantidad 
      FROM service_orders 
      WHERE client_id = $1 AND estado = 'cerrada'
    `, [id]);
    
    const ultimosServicios = await pool.query(`
      SELECT id, codigo_os, estado, total_general, "createdAt"
      FROM service_orders 
      WHERE client_id = $1
      ORDER BY "createdAt" DESC
      LIMIT 5
    `, [id]);
    
    const nombreCliente = cliente.tipo_persona === 'juridica' 
      ? cliente.razon_social 
      : `${cliente.primer_nombre || ''} ${cliente.primer_apellido || ''}`.trim();
    
    res.json({
      cliente: {
        ...cliente,
        nombre_completo: nombreCliente
      },
      totalServicios: totalServiciosResult.rows[0]?.total || 0,
      serviciosPorEstado: serviciosPorEstado.rows,
      serviciosPorMes: serviciosPorMes.rows,
      totalGenerado: datosFinancieros.rows[0]?.total_generado || 0,
      promedioPorServicio: datosFinancieros.rows[0]?.promedio || 0,
      servicioMasCaro: datosFinancieros.rows[0]?.maximo || 0,
      servicioMasBarato: datosFinancieros.rows[0]?.minimo || 0,
      serviciosPendientes: serviciosPendientes.rows[0]?.cantidad || 0,
      serviciosCompletados: serviciosCompletados.rows[0]?.cantidad || 0,
      ultimosServicios: ultimosServicios.rows,
    });
    
  } catch (error) {
    console.error('Error getting client stats:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas del cliente' });
  }
};

exports.getClientServiceOrders = async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT so.*, u.usuario as tecnico_nombre
      FROM service_orders so
      LEFT JOIN usuarios u ON so.tecnico_id = u.id
      WHERE so.client_id = $1
      ORDER BY so."createdAt" DESC
    `, [id]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting client services:', error);
    res.status(500).json({ message: 'Error al obtener servicios del cliente' });
  }
};