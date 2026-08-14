// backend/src/services/client-query.service.js
const pool = require('../db/pool');

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

const parsePositiveInteger = (
    value,
    fallback,
    maximum = Number.MAX_SAFE_INTEGER
) => {
    const parsed = Number.parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }

    return Math.min(parsed, maximum);
};

const normalizeOrigin = (origin) => {
    const allowed = new Set([
        'all',
        'local',
        'melissa',
    ]);

    return allowed.has(origin)
        ? origin
        : 'all';
};

const buildLocalClientsQuery = () => `
    SELECT
        c.id::text AS id,
        ('local:' || c.id::text) AS cliente_key,
        'local'::text AS origen,
        NULL::bigint AS id_externo,

        c.tipo_persona::text AS tipo_persona,
        c.tipo_documento::text AS tipo_documento,
        c.documento::text AS documento,

        c.razon_social::text AS razon_social,
        c.primer_nombre::text AS primer_nombre,
        c.segundo_nombre::text AS segundo_nombre,
        c.primer_apellido::text AS primer_apellido,
        c.segundo_apellido::text AS segundo_apellido,

        c.telefono::text AS telefono,
        c.email::text AS email,
        c.ciudad::text AS ciudad,

        c.activo AS activo,
        TRUE AS editable,

        c."createdAt" AS fecha_registro,

        COALESCE(
            NULLIF(BTRIM(c.razon_social), ''),
            NULLIF(
                BTRIM(
                    CONCAT_WS(
                        ' ',
                        c.primer_nombre,
                        c.segundo_nombre,
                        c.primer_apellido,
                        c.segundo_apellido
                    )
                ),
                ''
            ),
            c.documento::text,
            'Cliente sin nombre'
        ) AS nombre_mostrar

    FROM clients c

    WHERE c.activo = TRUE

    AND (
        $3 = ''
        OR LOWER(
            COALESCE(
                c.documento::text,
                ''
            )
        ) LIKE $4

        OR LOWER(
            COALESCE(
                c.razon_social,
                ''
            )
        ) LIKE $4

        OR LOWER(
            CONCAT_WS(
                ' ',
                c.primer_nombre,
                c.segundo_nombre,
                c.primer_apellido,
                c.segundo_apellido
            )
        ) LIKE $4

        OR LOWER(
            COALESCE(
                c.telefono,
                ''
            )
        ) LIKE $4

        OR LOWER(
            COALESCE(
                c.email,
                ''
            )
        ) LIKE $4
    )
`;

const buildMelissaClientsQuery = () => `
    SELECT
        sc.id_externo::text AS id,
        ('melissa:' || sc.id_externo::text) AS cliente_key,
        'melissa'::text AS origen,
        sc.id_externo::bigint AS id_externo,

        CASE
            WHEN NULLIF(
                BTRIM(sc.razon_social),
                ''
            ) IS NOT NULL
            THEN 'juridica'
            ELSE 'natural'
        END::text AS tipo_persona,

        sc.tipo_documento::text AS tipo_documento,
        sc.documento::text AS documento,

        sc.razon_social::text AS razon_social,
        sc.primer_nombre::text AS primer_nombre,
        sc.segundo_nombre::text AS segundo_nombre,
        sc.primer_apellido::text AS primer_apellido,
        sc.segundo_apellido::text AS segundo_apellido,

        NULL::text AS telefono,
        NULL::text AS email,
        NULL::text AS ciudad,

        sc.activo AS activo,
        FALSE AS editable,

        sc.fecha_sincronizacion AS fecha_registro,

        COALESCE(
            NULLIF(BTRIM(sc.razon_social), ''),
            NULLIF(
                BTRIM(
                    CONCAT_WS(
                        ' ',
                        sc.primer_nombre,
                        sc.segundo_nombre,
                        sc.primer_apellido,
                        sc.segundo_apellido
                    )
                ),
                ''
            ),
            sc.documento::text,
            'Cliente sin nombre'
        ) AS nombre_mostrar

    FROM sync_clientes sc

    WHERE sc.activo = TRUE

    AND (
        $3 = ''
        OR LOWER(
            COALESCE(
                sc.documento::text,
                ''
            )
        ) LIKE $4

        OR LOWER(
            COALESCE(
                sc.razon_social,
                ''
            )
        ) LIKE $4

        OR LOWER(
            CONCAT_WS(
                ' ',
                sc.primer_nombre,
                sc.segundo_nombre,
                sc.primer_apellido,
                sc.segundo_apellido
            )
        ) LIKE $4
    )
`;

const listClients = async ({
    page = 1,
    limit = DEFAULT_LIMIT,
    search = '',
    origin = 'all',
} = {}) => {
    const safePage = parsePositiveInteger(
        page,
        1
    );

    const safeLimit = parsePositiveInteger(
        limit,
        DEFAULT_LIMIT,
        MAX_LIMIT
    );

    const safeOrigin =
        normalizeOrigin(origin);

    const normalizedSearch =
        String(search || '')
            .trim()
            .toLowerCase();

    const searchPattern =
        normalizedSearch
            ? `%${normalizedSearch}%`
            : '';

    const offset =
        (safePage - 1) * safeLimit;

    const sources = [];

    if (
        safeOrigin === 'all' ||
        safeOrigin === 'local'
    ) {
        sources.push(
            buildLocalClientsQuery()
        );
    }

    if (
        safeOrigin === 'all' ||
        safeOrigin === 'melissa'
    ) {
        sources.push(
            buildMelissaClientsQuery()
        );
    }

    const query = `
        WITH clientes_unificados AS (
            ${sources.join('\nUNION ALL\n')}
        ),

        clientes_paginados AS (
            SELECT *
            FROM clientes_unificados

            ORDER BY
                CASE
                    WHEN $3 <> ''
                        AND LOWER(
                            COALESCE(
                                documento,
                                ''
                            )
                        ) = $3
                    THEN 0

                    WHEN $3 <> ''
                        AND LOWER(
                            COALESCE(
                                documento,
                                ''
                            )
                        ) LIKE ($3 || '%')
                    THEN 1

                    WHEN $3 <> ''
                        AND LOWER(
                            nombre_mostrar
                        ) = $3
                    THEN 2

                    WHEN $3 <> ''
                        AND LOWER(
                            nombre_mostrar
                        ) LIKE ($3 || '%')
                    THEN 3

                    ELSE 4
                END,

                nombre_mostrar ASC,
                documento ASC

            LIMIT $1
            OFFSET $2
        )

        SELECT
            COALESCE(
                JSON_AGG(
                    clientes_paginados
                ),
                '[]'::json
            ) AS data,

            (
                SELECT COUNT(*)::int
                FROM clientes_unificados
            ) AS total

        FROM clientes_paginados;
    `;

    const result = await pool.query(
        query,
        [
            safeLimit,
            offset,
            normalizedSearch,
            searchPattern,
        ]
    );

    const data =
        result.rows[0]?.data || [];

    const total =
        Number(result.rows[0]?.total || 0);

    const totalPages =
        total === 0
            ? 0
            : Math.ceil(
                total / safeLimit
            );

    return {
        success: true,

        data,

        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages,

            hasNextPage:
                safePage < totalPages,

            hasPreviousPage:
                safePage > 1,
        },

        filters: {
            search: normalizedSearch,
            origin: safeOrigin,
        },
    };
};

const searchClients = async ({
    search,
    limit = 20,
    origin = 'all',
}) => {
    return listClients({
        page: 1,
        limit,
        search,
        origin,
    });
};

module.exports = {
    listClients,
    searchClients,
};
