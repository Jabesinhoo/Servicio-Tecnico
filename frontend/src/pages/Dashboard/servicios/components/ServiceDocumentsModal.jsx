import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Download,
  FileCheck2,
  FileText,
  RefreshCw,
  Share2,
  ShieldCheck,
  X,
} from 'lucide-react';
import api from '../../../../services/api';
import ClientSignatureHistory from './ClientSignatureHistory';

const TYPE_LABELS = {
  reception_act:
    'Acta de recepción',
  technical_closure:
    'Acta de cierre técnico',
  final_delivery:
    'Acta de entrega final',
};

const fmt = (value) =>
  value
    ? new Date(value).toLocaleString(
        'es-CO',
        {
          dateStyle: 'medium',
          timeStyle: 'short',
        }
      )
    : '—';

const fileSize = (bytes) => {
  const value =
    Number(bytes || 0);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return '—';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  if (
    value <
    1024 * 1024
  ) {
    return `${(
      value / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    value /
    1024 /
    1024
  ).toFixed(1)} MB`;
};

export default function ServiceDocumentsModal({
  service,
  isAdmin,
  onClose,
  onOpenClosure,
  onOpenDelivery,
}) {
  const [branding,setBranding]=useState(()=>({logo_key:'logot',accent_color:'#8aa645',background_color:'#f3f6eb'}));
  const [preview,setPreview]=useState('');
  const previewRef = useRef(null);
  useEffect(() => { if (preview) previewRef.current?.scrollIntoView({behavior:'smooth',block:'start'}); }, [preview]);
  const [previewing,setPreviewing]=useState(false);
  const [data, setData] =
    useState(null);

  const deliveryReady=data?.delivery_status==='delivered';
  const closureReady=['technical_closed','handed_to_direction','direction_received','validated'].includes(data?.closure_status);
  const [loading, setLoading] =
    useState(false);

  const [busyType, setBusyType] =
    useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [prepared, setPrepared] = useState(null);
  const [sending, setSending] = useState(false);
  const [dispatch, setDispatch] = useState({ channel: 'whatsapp', recipient_name: '', recipient_contact: '', reference: '', confirmed_sent: false });

  useEffect(() => {
    setPrepared(null);
    setPreview('');
    setData(null);
    setNotice('');
  }, [service?.id]);

  const load = useCallback(
    async () => {
      if (!service?.id) {
        return;
      }

      try {
        setLoading(true);
        setError('');

        const response =
          await api.get(
            `/api/service-orders/${service.id}/documents`
          );

        setData(
          response.data?.data ||
          null
        );
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible cargar documentos formales'
        );
      } finally {
        setLoading(false);
      }
    },
    [service?.id]
  );

  useEffect(() => {
    if (!service) {
      return undefined;
    }

    const previous =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    load();

    const onKey = (
      event
    ) => {
      if (
        event.key ===
        'Escape'
      ) {
        onClose();
      }
    };

    window.addEventListener(
      'keydown',
      onKey
    );

    return () => {
      document.body.style.overflow =
        previous;

      window.removeEventListener(
        'keydown',
        onKey
      );
    };
  }, [
    service,
    load,
    onClose,
  ]);

  const documents =
    Array.isArray(
      data?.documents
    )
      ? data.documents
      : [];

  const availableTypes =
    Array.isArray(
      data?.available_types
    )
      ? data.available_types
      : Object.keys(
          TYPE_LABELS
        ).map(
          (key) => ({
            key,
            label:
              TYPE_LABELS[key],
          })
        );

  const grouped =
    useMemo(() => {
      const result =
        new Map();

      for (
        const document of
        documents
      ) {
        if (
          !result.has(
            document.document_type
          )
        ) {
          result.set(
            document.document_type,
            []
          );
        }

        result
          .get(
            document.document_type
          )
          .push(
            document
          );
      }

      return result;
    }, [documents]);

  const generate =
    async (
      documentType
    ) => {
      try {
        setBusyType(
          documentType
        );
        setError('');

        await api.post(
          `/api/service-orders/${service.id}/documents/${documentType}/generate`, {document_branding:branding}
        );

        await load();
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible generar el PDF formal'
        );
      } finally {
        setBusyType('');
      }
    };

  const openDocument =
    async (document) => {
      try {
        setError('');

        const response =
          await api.get(
            `/api/service-orders/${service.id}/documents/${document.id}/file`,
            {
              responseType:
                'blob',
            }
          );

        const blob =
          response.data;

        const url =
          URL.createObjectURL(
            blob
          );

        window.open(
          url,
          '_blank',
          'noopener,noreferrer'
        );

        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              url
            ),
          60000
        );
      } catch (requestError) {
        setError(
          requestError.response
            ?.data?.message ||
            'No fue posible abrir el documento'
        );
      }
    };

  const prepareSend = async (document) => {
    setSending(true);
    setError('');
    setNotice('');
    try {
      const response = await api.get(`/api/service-orders/${service.id}/documents/${document.id}/file`, { responseType: 'blob' });
      const file = new File([response.data], document.original_name || `${service.codigo_os}.pdf`, { type: 'application/pdf' });
      setPrepared({ document, file });
      setDispatch({ channel: 'whatsapp', recipient_name: data?.order?.client_name || '',
        recipient_contact: data?.order?.client_phone || '', reference: '', confirmed_sent: false });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible preparar el PDF');
    } finally { setSending(false); }
  };

  const downloadPrepared = () => {
    if (!prepared) return;
    const url = URL.createObjectURL(prepared.file);
    const link = document.createElement('a');
    link.href = url;
    link.download = prepared.file.name;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    setNotice('PDF descargado. Adjúntalo al mensaje o correo del cliente y registra el envío cuando lo hayas realizado.');
  };

  const sharePrepared = async () => {
    if (!prepared) return;
    try {
      if (navigator.canShare?.({ files: [prepared.file] }) && navigator.share) {
        await navigator.share({ files: [prepared.file], title: `Constancia ${service.codigo_os}` });
        setNotice('Verifica el destinatario y el envío en la aplicación elegida antes de registrar la entrega.');
      } else { downloadPrepared(); }
    } catch (error) {
      if (error.name !== 'AbortError') setError('No fue posible compartir. Usa Descargar PDF y adjunta el archivo al mensaje del cliente.');
    }
  };

  const recordDispatch = async () => {
    if (!prepared) return;
    setSending(true);
    setError('');
    try {
      await api.post(`/api/service-orders/${service.id}/documents/${prepared.document.id}/manual-dispatch`, dispatch);
      setPrepared(null);
      await load();
      setNotice('Envío manual registrado con destinatario, canal, fecha y responsable.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible registrar el envío');
    } finally { setSending(false); }
  };

  const showPreview=async(type)=>{setPreviewing(true);setError('');try{const r=await api.post(`/api/service-orders/${service.id}/documents/${type}/preview`,{document_branding:branding});if (!r.data?.data?.html) throw new Error('El servidor no devolvió la vista previa');setPreview(r.data.data.html);setNotice((r.data.data.warnings || []).join(' '));}catch(e){setError(e.response?.data?.message||e.message||'No se pudo obtener la vista previa');}finally{setPreviewing(false);}};
  if (!service) return null;

  return (
    <div className="workflow-theme fixed inset-0 z-[146] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide font-semibold accent-text">
              {service.codigo_os}
            </p>

            <h3 className="text-lg sm:text-xl font-bold">
              Documentos formales
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Consulta, descarga y entrega las constancias al cliente.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 p-3 sm:px-6 flex justify-end">
          <button
            type="button"
            disabled={loading}
            onClick={load}
            className="w-full sm:w-auto min-h-10 rounded-xl border border-slate-300 dark:border-slate-700 px-3 font-semibold text-sm flex items-center justify-center gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Actualizar
          </button>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-4"
          style={{
            WebkitOverflowScrolling:
              'touch',
          }}
        >
          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {notice && <div role="status" className="rounded-xl border accent-border p-3 text-sm accent-text dark:accent-text">{notice}</div>}
          <section className="rounded-xl border p-3 space-y-3"><h4 className="font-semibold">Logo y colores del acta</h4><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><label>Logo<select value={branding.logo_key} onChange={e=>{setBranding({...branding,logo_key:e.target.value});setPreview('');}} className="block w-full rounded-lg border bg-transparent p-2">{(data?.branding_options||[{key:'logot',label:'logot.png'},{key:'logo3',label:'logo3.jpeg'}]).map(option=><option key={option.key} value={option.key}>{option.label}{option.available===false?' · archivo pendiente':''}</option>)}</select></label><label>Color principal<input aria-label="Color principal del acta" type="color" value={branding.accent_color} onChange={e=>{setBranding({...branding,accent_color:e.target.value});setPreview('');}} className="block w-full"/></label><label>Color de fondo<input aria-label="Color de fondo del acta" type="color" value={branding.background_color} onChange={e=>{setBranding({...branding,background_color:e.target.value});setPreview('');}} className="block w-full"/></label></div>{data?.branding_options?.find(o=>o.key===branding.logo_key)?.data_uri&&<img src={data.branding_options.find(o=>o.key===branding.logo_key).data_uri} alt="Logo seleccionado" className="max-h-20 bg-white p-2 rounded"/>}<p className="text-xs text-gray-500">La vista previa muestra los datos actuales. Emitir un acta formal requiere confirmar el paso correspondiente.</p></section>
          {preview&&<section ref={previewRef} className="rounded-xl border p-2"><div className="flex justify-between mb-2"><h4 className="font-semibold">Vista previa del documento</h4><button onClick={()=>setPreview('')}>Cerrar vista previa</button></div><iframe title="Vista previa del acta" sandbox="" srcDoc={preview} className="w-full h-[65vh] bg-white rounded"/></section>}
          <ClientSignatureHistory service={service}/>
          {!deliveryReady&&<div className="rounded-xl border p-3 text-sm">El acta de entrega se emite después de registrar al receptor, su firma y confirmar la entrega. {onOpenDelivery&&<button type="button" onClick={()=>onOpenDelivery(service)} className="underline font-semibold">Abrir entrega final</button>}</div>}
          {!closureReady&&<div className="rounded-xl border border-amber-300 p-3 text-sm">El técnico asignado debe registrar el resultado y confirmar el cierre antes de emitir el acta de cierre técnico. {!isAdmin&&!service.creator_view_only&&onOpenClosure&&<button onClick={()=>onOpenClosure(service)} className="underline font-semibold">Abrir cierre técnico</button>}</div>}
          {prepared && (
            <section className="rounded-2xl border accent-border dark:accent-border p-4 space-y-3">
              <h4 className="font-bold">Enviar {prepared.file.name}</h4>
              <p className="text-sm text-slate-500">Comparte el archivo desde el dispositivo o descárgalo y adjúntalo en WhatsApp o correo. Luego registra el envío realizado.</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={sharePrepared} className="min-h-11 rounded-xl accent-fill text-white px-4 font-semibold">Compartir PDF</button>
                <button type="button" onClick={downloadPrepared} className="min-h-11 rounded-xl border border-slate-300 px-4 font-semibold">Descargar PDF</button>
                <button type="button" onClick={() => setPrepared(null)} className="min-h-11 px-4">Cerrar envío</button>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm">Canal
                  <select value={dispatch.channel} onChange={event => {
                    const channel = event.target.value;
                    setDispatch(prev => ({ ...prev, channel, confirmed_sent: false,
                      recipient_contact: channel === 'email' ? data?.order?.client_email || '' : channel === 'whatsapp' ? data?.order?.client_phone || '' : '' }));
                  }} className="block mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3">
                    <option value="whatsapp">WhatsApp</option><option value="email">Correo</option>
                    <option value="physical">Entrega física</option><option value="other">Otro</option>
                  </select>
                </label>
                <label className="text-sm">Destinatario *
                  <input value={dispatch.recipient_name} maxLength={180} onChange={event => setDispatch(prev => ({ ...prev, recipient_name: event.target.value }))} className="block mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3" />
                </label>
                <label className="text-sm">Contacto o identificación *
                  <input value={dispatch.recipient_contact} maxLength={220} onChange={event => setDispatch(prev => ({ ...prev, recipient_contact: event.target.value }))} className="block mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3" />
                </label>
                <label className="text-sm">Referencia / observación
                  <input value={dispatch.reference} maxLength={1000} onChange={event => setDispatch(prev => ({ ...prev, reference: event.target.value }))} className="block mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3" />
                </label>
              </div>
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={dispatch.confirmed_sent} onChange={event => setDispatch(prev => ({ ...prev, confirmed_sent: event.target.checked }))} className="mt-1" />Confirmo que ya envié o entregué este PDF al destinatario indicado.</label>
              <button type="button" disabled={sending || !dispatch.confirmed_sent} onClick={recordDispatch} className="min-h-11 rounded-xl accent-fill text-white px-4 font-semibold disabled:opacity-50">{sending ? 'Guardando...' : 'Registrar envío realizado'}</button>
            </section>
          )}

          <div className="rounded-2xl border accent-border dark:accent-border accent-soft dark:accent-soft p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 accent-text shrink-0 mt-0.5" />

              <div className="text-sm">
                <p className="font-bold">
                  Constancias del servicio
                </p>

                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Confirma la recepción, carga fotos y solicita la firma antes de generar el acta. Las versiones anteriores se conservan.
                </p>
              </div>
            </div>
          </div>

          {loading &&
          documents.length ===
            0 ? (
            <div className="py-12 text-center text-slate-500">
              Cargando documentos...
            </div>
          ) : (
            availableTypes.map(
              (type) => {
                const versions =
                  grouped.get(
                    type.key
                  ) || [];

                const latest =
                  versions[0] ||
                  null;

                return (
                  <section
                    key={
                      type.key
                    }
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden"
                  >
                    <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 accent-text shrink-0" />

                          <h4 className="font-bold">
                            {type.label ||
                              TYPE_LABELS[
                                type.key
                              ] ||
                              type.key}
                          </h4>
                        </div>

                        <p className="mt-1 text-xs text-slate-500">
                          {latest
                            ? `Última versión: v${latest.version} · ${fmt(
                                latest.generated_at
                              )}`
                            : 'Todavía no se ha generado.'}
                        </p>
                      </div>

                      <button type="button" disabled={previewing} onClick={()=>showPreview(type.key)} className="min-h-11 rounded-xl border px-3 py-2">{previewing?'Preparando…':'Vista previa'}</button>
                      <button
                        type="button"
                        onClick={() =>
                          generate(
                            type.key
                          )
                        }
                        disabled={
                          busyType === type.key || (type.key==='technical_closure'&&!closureReady)||(type.key==='final_delivery'&&!deliveryReady)
                        }
                        className="w-full lg:w-auto min-h-11 rounded-xl accent-fill hover:accent-fill disabled:opacity-50 text-white font-semibold px-4 flex items-center justify-center gap-2"
                      >
                        <FileCheck2 className="w-4 h-4" />

                        {busyType ===
                        type.key
                          ? 'Generando...'
                          : latest
                            ? 'Generar nueva versión'
                            : 'Generar PDF'}
                      </button>
                    </div>

                    <div className="border-t border-slate-200 dark:border-slate-800">
                      {versions.length >
                      0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                          {versions.map(
                            (
                              document
                            ) => (
                              <article
                                key={
                                  document.id
                                }
                                className="p-3 sm:px-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-sm">
                                      v{document.version}
                                    </span>

                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                        document.status ===
                                        'generated'
                                          ? 'accent-soft dark:accent-soft accent-text dark:accent-text'
                                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                      }`}
                                    >
                                      {document.status ===
                                      'generated'
                                        ? 'VIGENTE'
                                        : 'HISTÓRICO'}
                                    </span>
                                  </div>

                                  <p className="mt-1 text-xs text-slate-500 break-all">
                                    {fmt(
                                      document.generated_at
                                    )}
                                    {' · '}
                                    {fileSize(
                                      document.size_bytes
                                    )}
                                    {' · SHA-256 '}
                                    {String(
                                      document.sha256 ||
                                        ''
                                    ).slice(
                                      0,
                                      12
                                    )}
                                    …
                                  </p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                {document.status === 'generated' && <button type="button" disabled={sending} onClick={() => prepareSend(document)} className="min-h-10 rounded-xl accent-fill text-white px-3 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"><Share2 className="w-4 h-4" />Preparar envío</button>}
                                <button
                                  type="button"
                                  onClick={() =>
                                    openDocument(
                                      document
                                    )
                                  }
                                  className="w-full sm:w-auto min-h-10 rounded-xl border border-slate-300 dark:border-slate-700 px-3 font-semibold text-sm flex items-center justify-center gap-2"
                                >
                                  <Download className="w-4 h-4" />
                                  Abrir PDF
                                </button>
                                </div>
                              </article>
                            )
                          )}
                        </div>
                      ) : (
                        <div className="p-5 text-center text-sm text-slate-500">
                          Sin versiones.
                        </div>
                      )}
                    </div>
                  </section>
                );
              }
            )
          )}

          {(data?.dispatches || []).length > 0 && <section className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
            <h4 className="font-bold">Envíos registrados</h4>
            {(data.dispatches || []).map(item => {
              const doc = documents.find(document => document.id === item.document_id);
              return <p key={item.id} className="mt-2 text-sm">{TYPE_LABELS[doc?.document_type] || 'Documento'} v{doc?.version || '—'} · {item.metadata?.recipient_name} · {item.metadata?.recipient_contact} · {item.metadata?.channel} · {fmt(item.created_at)}{item.metadata?.reference ? ` · ${item.metadata.reference}` : ''}</p>;
            })}
          </section>}

          {!isAdmin && (
            <p className="text-xs text-slate-500">
              Los requisitos de cada documento se validan en el servidor. El acta de entrega final solo puede generarla administración.
            </p>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-5"
          >
            Cerrar
          </button>
        </footer>
      </section>
    </div>
  );
}
