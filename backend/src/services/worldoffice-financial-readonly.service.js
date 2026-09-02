'use strict';

const sql = require('mssql');

const OBJECT_TOKEN_WEIGHTS = new Map([
  ['factura', 12],
  ['invoice', 12],
  ['cartera', 11],
  ['receivable', 11],
  ['cuenta', 7],
  ['saldo', 9],
  ['balance', 9],
  ['pago', 8],
  ['payment', 8],
  ['abono', 8],
  ['recibo', 7],
  ['documento', 5],
  ['comprobante', 5],
  ['venta', 5],
  ['sales', 5],
  ['tercero', 4],
  ['cliente', 4],
]);

const COLUMN_TOKEN_WEIGHTS = new Map([
  ['factura', 8],
  ['invoice', 8],
  ['numero', 5],
  ['número', 5],
  ['documento', 5],
  ['comprobante', 5],
  ['idtercero', 7],
  ['tercero', 6],
  ['cliente', 6],
  ['nit', 5],
  ['identificacion', 5],
  ['identificación', 5],
  ['saldo', 8],
  ['balance', 8],
  ['total', 6],
  ['pagado', 7],
  ['paid', 7],
  ['abono', 6],
  ['valor', 4],
  ['monto', 4],
  ['fecha', 3],
  ['vencimiento', 4],
  ['estado', 4],
  ['status', 4],
]);

const SENSITIVE_COLUMN_TOKENS = [
  'password',
  'passwd',
  'pass',
  'clave',
  'secret',
  'token',
  'hash',
  'salt',
  'security',
  'seguridad',
];

const MAX_DISCOVERY_OBJECTS = Math.max(
  50,
  Math.min(
    5000,
    Number(
      process.env.WORLDOFFICE_FINANCIAL_DISCOVERY_MAX_OBJECTS ||
        1200
    )
  )
);

const DEFAULT_PREVIEW_ROWS = Math.max(
  1,
  Math.min(
    5,
    Number(
      process.env.WORLDOFFICE_FINANCIAL_PREVIEW_ROWS ||
        3
    )
  )
);

const QUERY_TIMEOUT_MS = Math.max(
  5000,
  Number(
    process.env.WORLDOFFICE_FINANCIAL_QUERY_TIMEOUT_MS ||
      30000
  )
);

function enabled() {
  return (
    String(
      process.env.WORLDOFFICE_FINANCIAL_READONLY_ENABLED ||
        ''
    )
      .trim()
      .toLowerCase() ===
    'true'
  );
}

function assertEnabled() {
  if (!enabled()) {
    const error =
      new Error(
        'La lectura financiera WorldOffice V18 está deshabilitada. Define WORLDOFFICE_FINANCIAL_READONLY_ENABLED=true en backend/.env.'
      );

    error.code =
      'WORLDOFFICE_READONLY_DISABLED';

    throw error;
  }
}

function requiredEnv() {
  return [
    'SQLSERVER_HOST',
    'SQLSERVER_DATABASE',
    'SQLSERVER_USER',
    'SQLSERVER_PASSWORD',
  ];
}

function configStatus() {
  const missing =
    requiredEnv().filter(
      (key) =>
        typeof process.env[key] !==
          'string' ||
        process.env[key]
          .trim().length ===
          0
    );

  return {
    enabled: enabled(),
    configured:
      missing.length === 0,
    missing,
    database:
      process.env.SQLSERVER_DATABASE ||
      null,
    instance_configured:
      Boolean(
        process.env.SQLSERVER_INSTANCE
      ),
  };
}

function getConfig() {
  assertEnabled();

  const status =
    configStatus();

  if (!status.configured) {
    const error =
      new Error(
        `Faltan variables WorldOffice: ${status.missing.join(', ')}`
      );

    error.code =
      'WORLDOFFICE_CONFIG_INCOMPLETE';

    throw error;
  }

  return {
    server:
      process.env.SQLSERVER_HOST,

    database:
      process.env.SQLSERVER_DATABASE,

    user:
      process.env.SQLSERVER_USER,

    password:
      process.env.SQLSERVER_PASSWORD,

    connectionTimeout:
      Number(
        process.env.SQLSERVER_CONNECTION_TIMEOUT ||
          20000
      ),

    requestTimeout:
      QUERY_TIMEOUT_MS,

    options: {
      instanceName:
        process.env.SQLSERVER_INSTANCE ||
        undefined,

      encrypt:
        String(
          process.env.SQLSERVER_ENCRYPT ||
            ''
        )
          .trim()
          .toLowerCase() ===
        'true',

      trustServerCertificate:
        String(
          process.env.SQLSERVER_TRUST_CERTIFICATE ||
            'true'
        )
          .trim()
          .toLowerCase() ===
        'true',

      enableArithAbort: true,
      useUTC: false,
    },

    pool: {
      max: 2,
      min: 0,
      idleTimeoutMillis: 15000,
    },
  };
}

async function withConnection(
  fn
) {
  const connection =
    new sql.ConnectionPool(
      getConfig()
    );

  try {
    await connection.connect();

    return await fn(
      connection
    );
  } finally {
    try {
      await connection.close();
    } catch (_) {}
  }
}

function normalizeName(
  value
) {
  return String(value || '')
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .toLowerCase();
}

function tokenScore(
  value,
  weights
) {
  const normalized =
    normalizeName(value);

  let score = 0;

  for (const [
    token,
    weight,
  ] of weights) {
    if (
      normalized.includes(
        normalizeName(token)
      )
    ) {
      score += weight;
    }
  }

  return score;
}

function isSensitiveColumn(
  name
) {
  const normalized =
    normalizeName(name);

  return SENSITIVE_COLUMN_TOKENS.some(
    (token) =>
      normalized.includes(token)
  );
}

function safeIdentifier(
  value
) {
  const text =
    String(value || '');

  if (
    !text ||
    text.length > 128 ||
    /[\u0000-\u001f]/.test(
      text
    )
  ) {
    const error =
      new Error(
        'Identificador SQL Server inválido'
      );

    error.code =
      'INVALID_SQL_IDENTIFIER';

    throw error;
  }

  return `[${text.replaceAll(
    ']',
    ']]'
  )}]`;
}

function qualifiedObject(
  schema,
  objectName
) {
  return `${safeIdentifier(
    schema
  )}.${safeIdentifier(
    objectName
  )}`;
}

async function health() {
  return withConnection(
    async (
      connection
    ) => {
      const result =
        await connection
          .request()
          .query(`
            SELECT
              DB_NAME() AS database_name,
              1 AS ok
          `);

      return {
        ok:
          Number(
            result.recordset?.[0]
              ?.ok ||
              0
          ) === 1,

        database_name:
          result.recordset?.[0]
            ?.database_name ||
          null,
      };
    }
  );
}

async function catalogSnapshot() {
  return withConnection(
    async (
      connection
    ) => {
      const request =
        connection.request();

      request.input(
        'maxObjects',
        sql.Int,
        MAX_DISCOVERY_OBJECTS
      );

      const result =
        await request.query(`
          ;WITH candidate_objects AS (
            SELECT TOP (@maxObjects)
              o.object_id,
              s.name AS schema_name,
              o.name AS object_name,
              CASE
                WHEN o.type = 'V'
                THEN 'VIEW'
                ELSE 'TABLE'
              END AS object_type
            FROM sys.objects o
            INNER JOIN sys.schemas s
              ON
                s.schema_id =
                  o.schema_id
            WHERE
              o.is_ms_shipped = 0
              AND
              o.type IN ('U','V')
            ORDER BY
              s.name,
              o.name
          )
          SELECT
            obj.schema_name,
            obj.object_name,
            obj.object_type,
            c.column_id,
            c.name AS column_name,
            t.name AS data_type,
            c.max_length,
            c.precision,
            c.scale,
            c.is_nullable
          FROM
            candidate_objects obj
          INNER JOIN sys.columns c
            ON
              c.object_id =
                obj.object_id
          INNER JOIN sys.types t
            ON
              t.user_type_id =
                c.user_type_id
          ORDER BY
            obj.schema_name,
            obj.object_name,
            c.column_id
        `);

      const byObject =
        new Map();

      for (const row of (
        result.recordset ||
        []
      )) {
        const key =
          `${row.schema_name}.${row.object_name}`;

        if (!byObject.has(key)) {
          byObject.set(
            key,
            {
              schema_name:
                row.schema_name,
              object_name:
                row.object_name,
              object_type:
                row.object_type,
              columns: [],
            }
          );
        }

        byObject
          .get(key)
          .columns
          .push({
            name:
              row.column_name,
            data_type:
              row.data_type,
            max_length:
              row.max_length,
            precision:
              row.precision,
            scale:
              row.scale,
            nullable:
              Boolean(
                row.is_nullable
              ),
          });
      }

      const objects =
        Array.from(
          byObject.values()
        );

      const scored =
        objects.map(
          (object) => {
            let score =
              tokenScore(
                `${object.schema_name} ${object.object_name}`,
                OBJECT_TOKEN_WEIGHTS
              );

            let hasInvoice = false;
            let hasClient = false;
            let hasBalance = false;
            let hasTotal = false;
            let hasPaid = false;

            for (const column of object.columns) {
              score +=
                tokenScore(
                  column.name,
                  COLUMN_TOKEN_WEIGHTS
                );

              const normalized =
                normalizeName(
                  column.name
                );

              hasInvoice ||= [
                'factura',
                'invoice',
                'numero',
                'documento',
                'comprobante',
              ].some(
                (token) =>
                  normalized.includes(
                    token
                  )
              );

              hasClient ||= [
                'tercero',
                'cliente',
                'nit',
                'identificacion',
              ].some(
                (token) =>
                  normalized.includes(
                    token
                  )
              );

              hasBalance ||= [
                'saldo',
                'balance',
              ].some(
                (token) =>
                  normalized.includes(
                    token
                  )
              );

              hasTotal ||= [
                'total',
                'valor',
                'monto',
              ].some(
                (token) =>
                  normalized.includes(
                    token
                  )
              );

              hasPaid ||= [
                'pagado',
                'paid',
                'abono',
                'pago',
              ].some(
                (token) =>
                  normalized.includes(
                    token
                  )
              );
            }

            if (hasInvoice) {
              score += 12;
            }

            if (hasClient) {
              score += 6;
            }

            if (hasBalance) {
              score += 16;
            } else if (
              hasTotal &&
              hasPaid
            ) {
              score += 12;
            }

            return {
              ...object,
              score,
              hints: {
                has_invoice:
                  hasInvoice,
                has_client:
                  hasClient,
                has_balance:
                  hasBalance,
                has_total:
                  hasTotal,
                has_paid:
                  hasPaid,
              },
            };
          }
        );

      const candidates =
        scored
          .filter(
            (item) =>
              item.score > 0
          )
          .sort(
            (a, b) =>
              b.score -
              a.score
          )
          .slice(0, 60);

      return {
        database_name:
          process.env
            .SQLSERVER_DATABASE,
        object_count:
          objects.length,
        candidate_count:
          candidates.length,
        candidates,
      };
    }
  );
}

async function getObjectMetadata(
  schemaName,
  objectName
) {
  return withConnection(
    async (
      connection
    ) => {
      const request =
        connection.request();

      request.input(
        'schemaName',
        sql.NVarChar(128),
        schemaName
      );

      request.input(
        'objectName',
        sql.NVarChar(128),
        objectName
      );

      const result =
        await request.query(`
          SELECT
            s.name AS schema_name,
            o.name AS object_name,
            CASE
              WHEN o.type = 'V'
              THEN 'VIEW'
              ELSE 'TABLE'
            END AS object_type,
            c.column_id,
            c.name AS column_name,
            t.name AS data_type,
            c.max_length,
            c.precision,
            c.scale,
            c.is_nullable
          FROM sys.objects o
          INNER JOIN sys.schemas s
            ON
              s.schema_id =
                o.schema_id
          INNER JOIN sys.columns c
            ON
              c.object_id =
                o.object_id
          INNER JOIN sys.types t
            ON
              t.user_type_id =
                c.user_type_id
          WHERE
            o.is_ms_shipped = 0
            AND
            o.type IN ('U','V')
            AND
            s.name =
              @schemaName
            AND
            o.name =
              @objectName
          ORDER BY
            c.column_id
        `);

      const rows =
        result.recordset ||
        [];

      if (!rows.length) {
        const error =
          new Error(
            'La tabla/vista seleccionada no existe en WorldOffice.'
          );

        error.code =
          'WORLDOFFICE_OBJECT_NOT_FOUND';

        throw error;
      }

      return {
        schema_name:
          rows[0].schema_name,
        object_name:
          rows[0].object_name,
        object_type:
          rows[0].object_type,
        columns:
          rows.map(
            (row) => ({
              name:
                row.column_name,
              data_type:
                row.data_type,
              max_length:
                row.max_length,
              precision:
                row.precision,
              scale:
                row.scale,
              nullable:
                Boolean(
                  row.is_nullable
                ),
            })
          ),
      };
    }
  );
}

async function previewObject(
  schemaName,
  objectName,
  limit =
    DEFAULT_PREVIEW_ROWS
) {
  const metadata =
    await getObjectMetadata(
      schemaName,
      objectName
    );

  const safeColumns =
    metadata.columns
      .filter(
        (column) =>
          !isSensitiveColumn(
            column.name
          )
      )
      .slice(0, 25);

  if (!safeColumns.length) {
    return {
      metadata,
      rows: [],
    };
  }

  return withConnection(
    async (
      connection
    ) => {
      const top =
        Math.max(
          1,
          Math.min(
            5,
            Number(limit) ||
              DEFAULT_PREVIEW_ROWS
          )
        );

      const selectColumns =
        safeColumns
          .map(
            (column) =>
              safeIdentifier(
                column.name
              )
          )
          .join(', ');

      const query =
        `
          SELECT TOP (${top})
            ${selectColumns}
          FROM
            ${qualifiedObject(
              schemaName,
              objectName
            )}
        `;

      const result =
        await connection
          .request()
          .query(query);

      return {
        metadata,
        preview_columns:
          safeColumns.map(
            (column) =>
              column.name
          ),
        rows:
          result.recordset ||
          [],
      };
    }
  );
}

function assertColumn(
  metadata,
  columnName,
  {
    required = false,
    label = 'columna',
  } = {}
) {
  const value =
    columnName
      ? String(
          columnName
        ).trim()
      : '';

  if (!value) {
    if (required) {
      const error =
        new Error(
          `Falta ${label}.`
        );

      error.code =
        'WORLDOFFICE_MAPPING_INVALID';

      throw error;
    }

    return null;
  }

  const exists =
    metadata.columns.some(
      (column) =>
        column.name ===
        value
    );

  if (!exists) {
    const error =
      new Error(
        `${label} no existe en ${metadata.schema_name}.${metadata.object_name}.`
      );

    error.code =
      'WORLDOFFICE_MAPPING_INVALID';

    throw error;
  }

  if (
    isSensitiveColumn(value)
  ) {
    const error =
      new Error(
        `${label} no puede usar una columna sensible.`
      );

    error.code =
      'WORLDOFFICE_MAPPING_INVALID';

    throw error;
  }

  return value;
}

async function validateMapping(
  mapping
) {
  const metadata =
    await getObjectMetadata(
      mapping.source_schema,
      mapping.source_object
    );

  const normalized = {
    source_schema:
      metadata.schema_name,

    source_object:
      metadata.object_name,

    source_object_type:
      metadata.object_type,

    invoice_reference_column:
      assertColumn(
        metadata,
        mapping.invoice_reference_column,
        {
          required: true,
          label:
            'la columna de referencia de factura',
        }
      ),

    client_document_column:
      assertColumn(
        metadata,
        mapping.client_document_column,
        {
          label:
            'la columna de documento del cliente',
        }
      ),

    client_external_id_column:
      assertColumn(
        metadata,
        mapping.client_external_id_column,
        {
          label:
            'la columna de ID externo del cliente',
        }
      ),

    total_amount_column:
      assertColumn(
        metadata,
        mapping.total_amount_column,
        {
          label:
            'la columna de valor total',
        }
      ),

    paid_amount_column:
      assertColumn(
        metadata,
        mapping.paid_amount_column,
        {
          label:
            'la columna de valor pagado',
        }
      ),

    balance_amount_column:
      assertColumn(
        metadata,
        mapping.balance_amount_column,
        {
          label:
            'la columna de saldo',
        }
      ),

    status_column:
      assertColumn(
        metadata,
        mapping.status_column,
        {
          label:
            'la columna de estado',
        }
      ),

    due_date_column:
      assertColumn(
        metadata,
        mapping.due_date_column,
        {
          label:
            'la columna de vencimiento',
        }
      ),

    currency_column:
      assertColumn(
        metadata,
        mapping.currency_column,
        {
          label:
            'la columna de moneda',
        }
      ),
  };

  if (
    !normalized.balance_amount_column &&
    !(
      normalized.total_amount_column &&
      normalized.paid_amount_column
    )
  ) {
    const error =
      new Error(
        'Para verificar saldo debes mapear una columna de saldo o las columnas total + pagado.'
      );

    error.code =
      'WORLDOFFICE_MAPPING_INVALID';

    throw error;
  }

  return {
    metadata,
    mapping:
      normalized,
  };
}

function normalizeText(
  value
) {
  return String(
    value ?? ''
  )
    .trim()
    .toUpperCase();
}

function normalizeIdentity(
  value
) {
  return normalizeText(
    value
  ).replace(
    /[^A-Z0-9]/g,
    ''
  );
}

function asMoney(
  value
) {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return null;
  }

  if (
    typeof value ===
    'number'
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : null;
  }

  let text =
    String(value)
      .trim()
      .replace(
        /\s/g,
        ''
      );

  if (!text) {
    return null;
  }

  if (
    text.includes(',') &&
    text.includes('.')
  ) {
    if (
      text.lastIndexOf(',') >
      text.lastIndexOf('.')
    ) {
      text =
        text
          .replaceAll('.', '')
          .replace(',', '.');
    } else {
      text =
        text.replaceAll(
          ',',
          ''
        );
    }
  } else if (
    text.includes(',')
  ) {
    text =
      text.replace(
        ',',
        '.'
      );
  }

  text =
    text.replace(
      /[^0-9.-]/g,
      ''
    );

  const number =
    Number(text);

  return Number.isFinite(
    number
  )
    ? number
    : null;
}

function selectAlias(
  columnName,
  alias
) {
  if (!columnName) {
    return `NULL AS ${safeIdentifier(
      alias
    )}`;
  }

  return `${safeIdentifier(
    columnName
  )} AS ${safeIdentifier(
    alias
  )}`;
}

async function queryMappedInvoice({
  mapping,
  invoiceReference,
  clientDocument,
  clientExternalId,
}) {
  assertEnabled();

  const {
    mapping:
      validated,
  } =
    await validateMapping(
      mapping
    );

  const invoiceValue =
    String(
      invoiceReference ||
        ''
    ).trim();

  if (!invoiceValue) {
    const error =
      new Error(
        'La OS no tiene referencia de factura para consultar WorldOffice.'
      );

    error.code =
      'WORLDOFFICE_INVOICE_REFERENCE_REQUIRED';

    throw error;
  }

  return withConnection(
    async (
      connection
    ) => {
      const selected = [
        selectAlias(
          validated.invoice_reference_column,
          '__invoice_reference'
        ),
        selectAlias(
          validated.client_document_column,
          '__client_document'
        ),
        selectAlias(
          validated.client_external_id_column,
          '__client_external_id'
        ),
        selectAlias(
          validated.total_amount_column,
          '__total_amount'
        ),
        selectAlias(
          validated.paid_amount_column,
          '__paid_amount'
        ),
        selectAlias(
          validated.balance_amount_column,
          '__balance_amount'
        ),
        selectAlias(
          validated.status_column,
          '__status'
        ),
        selectAlias(
          validated.due_date_column,
          '__due_date'
        ),
        selectAlias(
          validated.currency_column,
          '__currency'
        ),
      ].join(',\n');

      const request =
        connection.request();

      request.input(
        'invoiceReference',
        sql.NVarChar(255),
        invoiceValue
      );

      const query =
        `
          SELECT TOP (10)
            ${selected}
          FROM
            ${qualifiedObject(
              validated.source_schema,
              validated.source_object
            )}
          WHERE
            LTRIM(
              RTRIM(
                CONVERT(
                  nvarchar(255),
                  ${safeIdentifier(
                    validated.invoice_reference_column
                  )}
                )
              )
            ) =
            @invoiceReference
        `;

      const result =
        await request.query(
          query
        );

      const rawRows =
        result.recordset ||
        [];

      const expectedDocument =
        normalizeIdentity(
          clientDocument
        );

      const expectedExternalId =
        normalizeIdentity(
          clientExternalId
        );

      const normalizedRows =
        rawRows.map(
          (row) => {
            const total =
              asMoney(
                row.__total_amount
              );

            const paid =
              asMoney(
                row.__paid_amount
              );

            let balance =
              asMoney(
                row.__balance_amount
              );

            if (
              balance === null &&
              total !== null &&
              paid !== null
            ) {
              balance =
                total -
                paid;
            }

            const rowDocument =
              normalizeIdentity(
                row.__client_document
              );

            const rowExternalId =
              normalizeIdentity(
                row.__client_external_id
              );

            const documentMatches =
              !validated.client_document_column ||
              !expectedDocument ||
              rowDocument ===
                expectedDocument;

            const externalIdMatches =
              !validated.client_external_id_column ||
              !expectedExternalId ||
              rowExternalId ===
                expectedExternalId;

            return {
              invoice_reference:
                row.__invoice_reference ??
                null,

              client_document:
                row.__client_document ??
                null,

              client_external_id:
                row.__client_external_id ??
                null,

              total_amount:
                total,

              paid_amount:
                paid,

              balance_amount:
                balance,

              status:
                row.__status ??
                null,

              due_date:
                row.__due_date ??
                null,

              currency:
                row.__currency ??
                null,

              client_matches:
                documentMatches &&
                externalIdMatches,
            };
          }
        );

      const matchingRows =
        normalizedRows.filter(
          (row) =>
            row.client_matches
        );

      return {
        raw_match_count:
          normalizedRows.length,

        client_match_count:
          matchingRows.length,

        client_mismatch:
          normalizedRows.length >
            0 &&
          matchingRows.length ===
            0,

        rows:
          matchingRows,

        all_rows_normalized:
          normalizedRows,
      };
    }
  );
}

function summarizeLiveResult(
  queryResult,
  tolerance
) {
  const tol =
    Math.max(
      0,
      Number(tolerance) ||
        0
    );

  if (
    queryResult.raw_match_count ===
    0
  ) {
    return {
      result_status:
        'not_found',
      matched_rows: 0,
      eligible_zero_balance:
        false,
      record: null,
      message:
        'No se encontró la referencia de factura en el objeto configurado.',
    };
  }

  if (
    queryResult.client_mismatch
  ) {
    return {
      result_status:
        'client_mismatch',
      matched_rows:
        queryResult.raw_match_count,
      eligible_zero_balance:
        false,
      record: null,
      message:
        'La factura existe, pero no coincide con el cliente configurado en la OS.',
    };
  }

  if (
    queryResult.rows.length !==
    1
  ) {
    return {
      result_status:
        'ambiguous',
      matched_rows:
        queryResult.rows.length,
      eligible_zero_balance:
        false,
      record:
        queryResult.rows[0] ||
        null,
      message:
        'La consulta devolvió múltiples filas. V18 no agrega ni deduplica automáticamente; se requiere revisar el mapeo.',
    };
  }

  const record =
    queryResult.rows[0];

  if (
    record.balance_amount ===
    null
  ) {
    return {
      result_status:
        'pending',
      matched_rows: 1,
      eligible_zero_balance:
        false,
      record,
      message:
        'La factura coincide, pero no fue posible obtener un saldo numérico.',
    };
  }

  const zero =
    Math.abs(
      record.balance_amount
    ) <= tol;

  return {
    result_status:
      zero
        ? 'eligible_zero_balance'
        : 'pending',

    matched_rows: 1,

    eligible_zero_balance:
      zero,

    record,

    message:
      zero
        ? `Saldo dentro de tolerancia (${tol}). Puede registrarse una verificación de saldo cero.`
        : `Saldo pendiente detectado: ${record.balance_amount}. V18 no libera automáticamente una venta a crédito.`,
  };
}

module.exports = {
  enabled,
  configStatus,
  health,
  catalogSnapshot,
  getObjectMetadata,
  previewObject,
  validateMapping,
  queryMappedInvoice,
  summarizeLiveResult,
};
