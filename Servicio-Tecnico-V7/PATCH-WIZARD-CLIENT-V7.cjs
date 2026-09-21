const fs = require('fs');
const path = require('path');

const root = process.argv[2];
if (!root) throw new Error('Falta ProjectRoot');

const file = path.join(
  root,
  'frontend',
  'src',
  'pages',
  'Dashboard',
  'servicios',
  'ServicioCreateWizard.jsx'
);

if (!fs.existsSync(file)) {
  throw new Error(`No existe el wizard: ${file}`);
}

let text = fs.readFileSync(file, 'utf8');

if (!text.includes('V7_CLIENT_SWITCH')) {
  const stateMarker =
    "const [selectedClient, setSelectedClient] = useState(null);";

  if (!text.includes(stateMarker)) {
    throw new Error('No encontré el estado selectedClient del wizard.');
  }

  text = text.replace(
    stateMarker,
    `${stateMarker}
  // V7_CLIENT_SWITCH
  const isEditMode = mode === 'edit';
  const canChangeClient = isAdmin && isEditMode;`
  );

  const oldCard = `                {selectedClient && (
                  <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                    <p className="font-semibold">{clientName(selectedClient)}</p>
                    <p className="text-sm text-gray-500">
                      {selectedClient.documento || 'Sin documento'} ·{' '}
                      {selectedClient.telefono || 'Sin teléfono'}
                    </p>
                  </div>
                )}`;

  const newCard = `                {selectedClient && (
                  <div className="mt-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/20 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold">{clientName(selectedClient)}</p>
                        <p className="text-sm text-gray-500">
                          {selectedClient.documento || 'Sin documento'} ·{' '}
                          {selectedClient.telefono || 'Sin teléfono'}
                        </p>
                      </div>
                      {canChangeClient && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedClient(null);
                            setClientQuery('');
                            setClients([]);
                          }}
                          className="shrink-0 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-xs font-semibold hover:bg-white dark:hover:bg-gray-900"
                        >
                          Cambiar cliente
                        </button>
                      )}
                    </div>
                  </div>
                )}`;

  if (!text.includes(oldCard)) {
    throw new Error('No encontré la tarjeta del cliente seleccionado.');
  }

  text = text.replace(oldCard, newCard);

  const firstEffect = "  useEffect(() => {\n    if (!isOpen) return undefined;";
  if (!text.includes(firstEffect)) {
    throw new Error('No encontré el primer useEffect del wizard.');
  }

  const editEffect = `  useEffect(() => {
    if (!isOpen || !isEditMode || selectedClient || !service?.client_id) return;

    setSelectedClient({
      id: service.client_id,
      documento: service.cliente_documento || '',
      razon_social: service.cliente_razon_social || '',
      primer_nombre: service.cliente_nombre || '',
      primer_apellido: '',
      telefono: service.cliente_telefono || '',
      email: service.cliente_email || '',
      direccion: service.cliente_direccion || '',
      ciudad: service.cliente_ciudad || '',
      codigo_worldoffice: service.cliente_codigo_worldoffice || '',
      tipo_persona: service.cliente_tipo_persona || null,
    });

    setClientQuery(
      service.cliente_nombre ||
      service.cliente_razon_social ||
      service.cliente_documento ||
      ''
    );
  }, [
    isOpen,
    isEditMode,
    selectedClient,
    service?.client_id,
    service?.cliente_nombre,
    service?.cliente_razon_social,
    service?.cliente_documento,
  ]);

`;

  text = text.replace(firstEffect, editEffect + firstEffect);
  fs.writeFileSync(file, text, 'utf8');
  console.log('OK wizard: cambio de cliente habilitado en edición.');
} else {
  console.log('OK wizard: V7_CLIENT_SWITCH ya estaba aplicado.');
}
