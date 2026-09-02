'use strict';

const fs = require('fs');
const path = require('path');

const envPath =
  path.resolve(
    __dirname,
    '../.env'
  );

if (fs.existsSync(envPath)) {
  require('dotenv').config({
    path: envPath,
    quiet: true,
  });
}

const service =
  require('../src/services/worldoffice-financial-readonly.service');

async function main() {
  const status =
    service.configStatus();

  console.log(
    'V18 WORLDOFFICE READ-ONLY DISCOVERY'
  );

  console.log({
    enabled:
      status.enabled,
    configured:
      status.configured,
    missing:
      status.missing,
    database:
      status.database,
  });

  const health =
    await service.health();

  console.log(
    'Conexion:',
    health
  );

  const snapshot =
    await service.catalogSnapshot();

  const reportDir =
    path.resolve(
      __dirname,
      '../reports/worldoffice'
    );

  fs.mkdirSync(
    reportDir,
    {
      recursive: true,
    }
  );

  const stamp =
    new Date()
      .toISOString()
      .replace(
        /[:.]/g,
        '-'
      );

  const file =
    path.join(
      reportDir,
      `financial-discovery-v18-${stamp}.json`
    );

  const output = {
    generated_at:
      new Date()
        .toISOString(),
    mode:
      'read_only_metadata',
    database_name:
      snapshot.database_name,
    object_count:
      snapshot.object_count,
    candidate_count:
      snapshot.candidate_count,
    candidates:
      snapshot.candidates,
  };

  fs.writeFileSync(
    file,
    JSON.stringify(
      output,
      null,
      2
    ),
    'utf8'
  );

  console.log(
    `Objetos analizados: ${snapshot.object_count}`
  );

  console.log(
    `Candidatos: ${snapshot.candidate_count}`
  );

  console.log(
    'Top candidatos:'
  );

  for (
    const candidate of
    snapshot.candidates.slice(
      0,
      15
    )
  ) {
    console.log(
      `- ${candidate.schema_name}.${candidate.object_name} [${candidate.object_type}] score=${candidate.score}`
    );
  }

  console.log(
    `Reporte local: ${file}`
  );

  console.log(
    'WorldOffice no fue modificado.'
  );
}

main().catch(
  (error) => {
    console.error(
      'V18 discovery error:',
      error
    );

    process.exitCode = 1;
  }
);
