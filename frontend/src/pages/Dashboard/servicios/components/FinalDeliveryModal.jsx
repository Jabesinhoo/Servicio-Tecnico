import FinancialControlModal from './FinancialControlModal';
import ResponsiveSignaturePad from '../../../../components/ui/ResponsiveSignaturePad';
import React, { useCallback, useEffect,  useState } from 'react';
import {
  Bell,
  Camera,
  CheckCircle2,
  FileSignature,
  Handshake,
  PackageCheck,
  Printer,
  Send,
  Star,
  UserCheck,
  X,
} from 'lucide-react';
import api from '../../../../services/api';

const fmt = (value) =>
  value
    ? new Date(value).toLocaleString('es-CO', {
        dateStyle: 'medium',
        timeStyle: 'short',
      timeZone: 'America/Bogota',
      })
    : '—';

const escapeHtml = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

export default function FinalDeliveryModal({
  service,
  isAdmin,
  currentUserId,
  onOpenClosure,
  onOpenAuthorization,
  onClose,
  onRefresh,
}) {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;
  const [data, setData] = useState(null);
  const [showExtraPayment,setShowExtraPayment]=useState(false);
  const [financialControl, setFinancialControl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [channel, setChannel] = useState('whatsapp');
  const [recipientName, setRecipientName] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const [notificationReference, setNotificationReference] = useState('');
  const [notificationNote, setNotificationNote] = useState('');

  const [receiverType, setReceiverType] = useState('client');
  const [receiverName, setReceiverName] = useState('');
  const [receiverDocument, setReceiverDocument] = useState('');
  const [receiverPhone, setReceiverPhone] = useState('');
  const [receiverRelationship, setReceiverRelationship] = useState('');
  const [identityVerified, setIdentityVerified] = useState(false);
  const [finalConditionVerified, setFinalConditionVerified] = useState(false);
  const [accessoriesVerified, setAccessoriesVerified] = useState(false);
  const [financialClearance, setFinancialClearance] = useState(false);
  const [financialNote, setFinancialNote] = useState('');
  const [thirdPartyAuthorizationNote, setThirdPartyAuthorizationNote] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');

  const [canvas, setCanvas] = useState(null);
  const [hasInk, setHasInk] = useState(false);
  const [clearToken, setClearToken] = useState(0);
  const [signatureUrl, setSignatureUrl] = useState('');

  const [rating, setRating] = useState(5);
  const [wouldRecommend, setWouldRecommend] = useState(true);
  const [satisfactionComment, setSatisfactionComment] = useState('');

  const load = useCallback(async () => {
    if (!service?.id) return;
    try {
      setLoading(true);
      setError('');

      const response = await api.get(`/api/service-orders/${service.id}/delivery`);
      const payload = response.data?.data || null;
      setData(payload);
      const financialPayload = {ready_for_delivery:payload?.extra_financial?.ready !== false};
      setFinancialControl(financialPayload);

      const order = payload?.order || {};
      const delivery = payload?.delivery || {};
      setRecipientName(order.client_name || '');
      setRecipientContact(order.client_phone || order.client_email || '');
      setReceiverType(delivery.receiver_type || 'client');
      setReceiverName(delivery.receiver_name || order.client_name || '');
      setReceiverDocument(delivery.receiver_document || order.client_document || '');
      setReceiverPhone(delivery.receiver_phone || order.client_phone || '');
      setReceiverRelationship(delivery.receiver_relationship || '');
      setIdentityVerified(Boolean(delivery.identity_verified));
      setFinalConditionVerified(Boolean(delivery.final_condition_verified));
      setAccessoriesVerified(Boolean(delivery.accessories_verified));
      setFinancialClearance(
        Boolean(delivery.financial_clearance)
      );
      setFinancialNote(delivery.financial_note || '');
      setThirdPartyAuthorizationNote(delivery.third_party_authorization_note || '');
      setDeliveryNote(delivery.delivery_note || '');

      if (payload?.satisfaction) {
        setRating(Number(payload.satisfaction.rating || 5));
        setWouldRecommend(payload.satisfaction.would_recommend !== false);
        setSatisfactionComment(payload.satisfaction.comment || '');
      }

      try {
        const signature = await api.get(
          `/api/service-orders/${service.id}/delivery/signature`,
          { responseType: 'blob' }
        );
        setSignatureUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return URL.createObjectURL(signature.data);
        });
      } catch (signatureError) {
        if (signatureError.response?.status !== 404) console.error(signatureError);
        setSignatureUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return '';
        });
      }
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible cargar la entrega final');
    } finally {
      setLoading(false);
    }
  }, [service?.id]);

  useEffect(() => {
    if (!service) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    load();
    const onKey = (event) => event.key === 'Escape' && onCloseRef.current();
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [service, load]);

  useEffect(
    () => () => {
      if (signatureUrl) URL.revokeObjectURL(signatureUrl);
    },
    [signatureUrl]
  );

  if (!service) return null;

  const order = data?.order || {};
  const closure = data?.closure || null;
  const delivery = data?.delivery || { status: 'draft' };
  const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
  const evidences = Array.isArray(data?.evidences) ? data.evidences : [];
  const thirdPartyEvidence = evidences.filter(
    (item) => item.category === 'third_party_authorization'
  );
  const canEdit = data?.permissions?.can_prepare_delivery === true;
  const canSatisfaction = data?.permissions?.can_record_satisfaction === true;
  const custodyMine = data?.current_custody_holder === currentUserId;

  const financialRequired = data?.extra_financial?.required === true;
  const financialReady = data?.extra_financial?.ready !== false;
  const closureReady = ['technical_closed','handed_to_direction','direction_received','validated'].includes(closure?.status);

  const whatsappUrl = () => {
    let number = String(receiverPhone || order.client_phone || '').replace(/\D/g,'');
    if (number.length===10 && number.startsWith('3')) number='57'+number;
    if(number.length<10||number.length>15){setError('Revisa el teléfono del cliente para abrir WhatsApp.');return '';}
    return 'https://wa.me/'+number+'?text='+encodeURIComponent('Hola '+(order.client_name||receiverName)+', sobre tu servicio '+(service.codigo_os||'')+'. Te compartiremos el acta de entrega.');
  };
  const openWhatsApp = () => {const url=whatsappUrl();if(url)window.open(url,'_blank','noopener,noreferrer');};

  const saveDraft = async () => {
    await api.put(`/api/service-orders/${service.id}/delivery`, {
      receiver_type: receiverType,
      receiver_name: receiverName,
      receiver_document: receiverDocument,
      receiver_phone: receiverPhone,
      receiver_relationship: receiverRelationship,
      identity_verified: identityVerified,
      final_condition_verified: finalConditionVerified,
      accessories_verified: accessoriesVerified,
      financial_clearance: financialClearance,
      financial_note: financialNote,
      third_party_authorization_note: thirdPartyAuthorizationNote,
      delivery_note: deliveryNote,
    });
  };

  const run = async (fn) => {
    try {
      setSaving(true);
      setError('');
      await fn();
      await load();
      await onRefresh?.();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          'No fue posible completar la acción'
      );
    } finally {
      setSaving(false);
    }
  };

  const notifyClient = () =>
    run(async () => {
      await api.post(`/api/service-orders/${service.id}/delivery/notifications`, {
        channel,
        recipient_name: recipientName,
        recipient_contact: recipientContact,
        reference: notificationReference,
        note: notificationNote,
      });
      setNotificationReference('');
      setNotificationNote('');
    });

  const uploadEvidence = (file, category) =>
    run(async () => {
      await api.post(
        `/api/service-orders/${service.id}/delivery/evidences`,
        file,
        {
          params: { category, name: file.name },
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        }
      );
    });

  const openEvidence = async (evidence) => {
    try {
      const response = await api.get(
        `/api/service-orders/${service.id}/delivery/evidences/${evidence.id}/file`,
        { responseType: 'blob' }
      );
      const url = URL.createObjectURL(response.data);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'No fue posible abrir el soporte');
    }
  };

  const saveSignature = () =>
    run(async () => {
      if (!canvas || !hasInk) throw new Error('Firma el acta antes de guardar.');
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('No fue posible generar la firma');
      await api.post(
        `/api/service-orders/${service.id}/delivery/signature`,
        blob,
        { headers: { 'Content-Type': 'image/png' } }
      );
      setClearToken((value) => value + 1);
    });

  const confirm = () =>
    run(async () => {
      await saveDraft();
      if (hasInk && canvas) {
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
        if(!blob)throw new Error('No fue posible guardar la firma.');
        await api.post(`/api/service-orders/${service.id}/delivery/signature`,blob,{headers:{'Content-Type':'image/png'}});
        setClearToken(value=>value+1);
      } else if (!delivery.signature_storage_path && !signatureUrl) throw new Error('Firma el acta antes de confirmar la entrega.');
      await api.post(`/api/service-orders/${service.id}/delivery/confirm`);
    });

  const saveSatisfaction = () =>
    run(async () => {
      await api.put(`/api/service-orders/${service.id}/delivery/satisfaction`, {
        rating: Number(rating),
        would_recommend: wouldRecommend,
        comment: satisfactionComment,
      });
    });

  const printAct = () => {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    if (!popup) {
      setError('El navegador bloqueó la ventana de impresión.');
      return;
    }

    const notification = notifications[0] || null;

    popup.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8"/>
        <title>Acta ${escapeHtml(order.codigo_os || '')}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:32px;color:#111}
          h1{font-size:22px;margin-bottom:4px} h2{font-size:16px;margin-top:26px}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          .box{border:1px solid #ddd;border-radius:8px;padding:12px}
          .muted{font-size:12px;color:#666}
          img{max-width:420px;max-height:160px;object-fit:contain;border:1px solid #ddd}
          @media print{button{display:none}}
        </style>
      </head>
      <body>
        <h1>Acta de entrega final</h1>
        <div class="muted">${escapeHtml(order.codigo_os || '')}</div>

        <h2>Cliente</h2>
        <div class="grid">
          <div class="box"><b>Cliente</b><br>${escapeHtml(order.client_name || '—')}</div>
          <div class="box"><b>Documento</b><br>${escapeHtml(order.client_document || '—')}</div>
        </div>

        <h2>Receptor</h2>
        <div class="grid">
          <div class="box"><b>Tipo</b><br>${escapeHtml(delivery.receiver_type === 'third_party' ? 'Tercero autorizado' : 'Cliente')}</div>
          <div class="box"><b>Nombre</b><br>${escapeHtml(delivery.receiver_name || '—')}</div>
          <div class="box"><b>Documento</b><br>${escapeHtml(delivery.receiver_document || '—')}</div>
          <div class="box"><b>Teléfono</b><br>${escapeHtml(delivery.receiver_phone || '—')}</div>
        </div>

        <h2>Controles</h2>
        <div class="box">
          ✓ Identidad verificada<br>
          ✓ Estado final verificado<br>
          ✓ Accesorios verificados<br>
          ✓ Liberación financiera confirmada
        </div>

        <h2>Notificación</h2>
        <div class="box">
          ${
            notification
              ? `${escapeHtml(notification.channel)} · ${escapeHtml(fmt(notification.notified_at))}<br>${escapeHtml(notification.reference || notification.note || 'Registro realizado')}`
              : 'Sin registro'
          }
        </div>

        <h2>Entrega</h2>
        <div class="box">
          Fecha: ${escapeHtml(fmt(delivery.delivered_at))}<br>
          Observación: ${escapeHtml(delivery.delivery_note || '—')}
        </div>

        <h2>Firma</h2>
        ${signatureUrl ? `<img src="${signatureUrl}" alt="Firma"/>` : '<div class="box">Firma no disponible.</div>'}

        ${
          data?.satisfaction
            ? `<h2>Satisfacción</h2><div class="box">
                Calificación: ${escapeHtml(data.satisfaction.rating)}/5<br>
                Recomendaría: ${data.satisfaction.would_recommend === false ? 'No' : 'Sí'}<br>
                Comentario: ${escapeHtml(data.satisfaction.comment || '—')}
              </div>`
            : ''
        }

        <p class="muted" style="margin-top:30px">Documento generado desde Servicio Técnico.</p>
        <button onclick="window.print()">Imprimir / Guardar como PDF</button>
      </body>
      </html>
    `);
    popup.document.close();
  };

  return (
    <div className="workflow-theme fixed inset-0 z-[140] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[94dvh] sm:max-w-6xl bg-white dark:bg-slate-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide font-semibold accent-text">{service.codigo_os}</p>
            <h3 className="text-lg sm:text-xl font-bold">Entrega final al cliente</h3>
            <p className="text-sm text-slate-500 mt-1">
              Receptor, firma y entrega definitiva. Compartir por WhatsApp es opcional.
            </p>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center shrink-0">
            <X className="w-5 h-5"/>
          </button>
        </header>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5 space-y-5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {error && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center text-slate-500">Cargando...</div>
          ) : (
            <>
              <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs text-slate-500">Cierre técnico</p>
                  <p className="font-semibold mt-1">{closureReady ? 'Trabajo finalizado' : 'Pendiente'}</p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs text-slate-500">Custodia</p>
                  <p className="font-semibold mt-1">
                    {data?.current_custody_holder ? (custodyMine ? 'En tus manos' : 'Otro usuario') : 'Liberada'}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                  <p className="text-xs text-slate-500">Entrega</p>
                  <p className="font-semibold mt-1">
                    {delivery.status === 'delivered' ? `Completada ${fmt(delivery.delivered_at)}` : 'Pendiente'}
                  </p>
                </div>
              </section>

              <section className="rounded-xl border p-4 text-sm"><p>Después de confirmar la entrega, genera el acta en Documentos PDF. Puedes descargarla y adjuntarla al chat del cliente.</p><button type="button" onClick={openWhatsApp} className="mt-3 min-h-11 border rounded-xl px-4 flex gap-2 items-center"><Send className="w-4 h-4"/>Abrir WhatsApp del cliente</button><p className="mt-2 text-xs text-slate-500">Abrir el chat no envía el acta ni registra un envío.</p></section>
              {financialRequired && <section className="rounded-xl border p-4"><p className="font-semibold">Cobros de servicios extra: {financialReady?'Revisados':'Pendientes de revisión por administración'}</p><p className="text-sm mt-1">Este control corresponde a trabajos adicionales aprobados, no al servicio principal.</p>{isAdmin&&<button type="button" className="mt-2 underline" onClick={()=>setShowExtraPayment(true)}>Revisar cobros extra</button>}</section>}

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 accent-text"/>
                  <h4 className="font-bold">Receptor de la entrega</h4>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button type="button" disabled={!canEdit} onClick={() => setReceiverType('client')} className={`min-h-20 rounded-2xl border p-4 text-left ${receiverType === 'client' ? 'accent-border accent-soft dark:accent-soft' : 'border-slate-200 dark:border-slate-800'} disabled:opacity-70`}>
                    <p className="font-bold">Cliente</p>
                    <p className="text-sm text-slate-500 mt-1">Entrega directamente al titular.</p>
                  </button>
                  <button type="button" disabled={!canEdit} onClick={() => setReceiverType('third_party')} className={`min-h-20 rounded-2xl border p-4 text-left ${receiverType === 'third_party' ? 'accent-border accent-soft dark:accent-soft' : 'border-slate-200 dark:border-slate-800'} disabled:opacity-70`}>
                    <p className="font-bold">Tercero autorizado</p>
                    <p className="text-sm text-slate-500 mt-1">Exige soporte escrito de autorización.</p>
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <label><span className="text-sm font-semibold">Nombre *</span><input disabled={!canEdit} value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 disabled:opacity-70"/></label>
                  <label><span className="text-sm font-semibold">Documento *</span><input disabled={!canEdit} value={receiverDocument} onChange={(e) => setReceiverDocument(e.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 disabled:opacity-70"/></label>
                  <label><span className="text-sm font-semibold">Teléfono</span><input disabled={!canEdit} value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 disabled:opacity-70"/></label>
                  {receiverType === 'third_party' && (
                    <label><span className="text-sm font-semibold">Relación *</span><input disabled={!canEdit} value={receiverRelationship} onChange={(e) => setReceiverRelationship(e.target.value)} placeholder="Familiar, mensajero, empleado..." className="mt-1 w-full min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 disabled:opacity-70"/></label>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    [identityVerified,setIdentityVerified,'Identidad del receptor verificada',false],
                    [finalConditionVerified,setFinalConditionVerified,'Estado final del equipo verificado',false],
                    [accessoriesVerified,setAccessoriesVerified,'Accesorios entregados y verificados',false],
                  ].map(([checked,setter,label,locked]) => (
                    <label key={label} className="min-h-12 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex items-start gap-3">
                      <input
                        type="checkbox"
                        disabled={!canEdit || locked}
                        checked={Boolean(checked)}
                        onChange={(e) => setter(e.target.checked)}
                        className="mt-0.5 w-5 h-5 shrink-0"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>


                {receiverType === 'third_party' && (
                  <div className="mt-4 rounded-xl border accent-border dark:accent-border accent-soft dark:accent-soft p-4">
                    <label className="block">
                      <span className="text-sm font-semibold">Referencia de autorización *</span>
                      <textarea disabled={!canEdit} rows={2} value={thirdPartyAuthorizationNote} onChange={(e) => setThirdPartyAuthorizationNote(e.target.value)} placeholder="Quién autorizó, medio, fecha..." className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 disabled:opacity-70"/>
                    </label>

                    {canEdit && (
                      <label className="mt-3 min-h-11 rounded-xl border border-dashed accent-border accent-text dark:accent-text px-3 flex items-center justify-center gap-2 cursor-pointer">
                        <Camera className="w-4 h-4"/> Adjuntar autorización escrita
                        <input
                          type="file"
                          className="hidden"
                          accept="image/jpeg,image/png,image/webp,application/pdf"
                          disabled={saving}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) uploadEvidence(file, 'third_party_authorization');
                            event.target.value = '';
                          }}
                        />
                      </label>
                    )}

                    <div className="mt-3 space-y-2">
                      {thirdPartyEvidence.map((evidence) => (
                        <button key={evidence.id} type="button" onClick={() => openEvidence(evidence)} className="w-full min-h-11 rounded-xl border accent-border dark:accent-border p-3 text-left text-sm">
                          {evidence.original_name || 'Autorización'} · {fmt(evidence.created_at)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <label className="mt-3 block">
                  <span className="text-sm font-semibold">Observación de entrega</span>
                  <textarea disabled={!canEdit} rows={3} value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 disabled:opacity-70"/>
                </label>

                {canEdit && (
                  <button type="button" disabled={saving} onClick={() => run(saveDraft)} className="mt-3 w-full sm:w-auto min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-4">
                    Guardar datos de entrega
                  </button>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
                <div className="flex items-center gap-2">
                  <FileSignature className="w-4 h-4 accent-text"/>
                  <h4 className="font-bold">Firma del receptor</h4>
                </div>

                {signatureUrl && (
                  <img src={signatureUrl} alt="Firma de entrega" className="mt-3 w-full max-w-xl h-40 object-contain rounded-xl border border-slate-200 dark:border-slate-800 bg-white"/>
                )}

                {canEdit && (
                  <>
                    <div className="mt-3">
                      <ResponsiveSignaturePad
                        onChange={(canvasNode, ink) => {
                          setCanvas(canvasNode);
                          setHasInk(ink);
                        }}
                        clearToken={clearToken}
                      />
                    </div>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <button type="button" onClick={() => setClearToken((v) => v + 1)} className="min-h-11 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">
                        Limpiar firma
                      </button>
                      <button type="button" disabled={saving || !hasInk} onClick={saveSignature} className="min-h-11 rounded-xl accent-fill hover:accent-fill disabled:opacity-50 text-white font-semibold">
                        Guardar firma
                      </button>
                    </div>
                  </>
                )}
              </section>

              {canEdit && (
                <section className="rounded-2xl border accent-border dark:accent-border accent-soft dark:accent-soft p-4">
                  {!custodyMine && (
                    <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-300">
                      La custodia actual pertenece a otro usuario. Debe confirmar la entrega quien tenga la custodia.
                    </div>
                  )}
                  <button type="button" disabled={saving || !custodyMine || data?.permissions?.can_manage_delivery !== true || !financialReady} onClick={confirm} className="w-full min-h-12 rounded-xl accent-fill hover:accent-fill disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2">
                    <PackageCheck className="w-5 h-5"/> Confirmar entrega final y cerrar OS
                  </button>
                </section>
              )}

              {delivery.status === 'delivered' && (
                <>
                  <section className="rounded-2xl border accent-border dark:accent-border accent-soft dark:accent-soft p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 accent-text shrink-0 mt-0.5"/>
                      <div>
                        <p className="font-bold accent-text dark:accent-text">Entrega final completada</p>
                        <p className="text-sm mt-1">{delivery.receiver_name} · {delivery.receiver_document}</p>
                        <p className="text-xs accent-text dark:accent-text mt-1">{fmt(delivery.delivered_at)}</p>
                      </div>
                    </div>
                    <button type="button" onClick={printAct} className="mt-3 w-full sm:w-auto min-h-11 rounded-xl border accent-border dark:accent-border accent-text dark:accent-text px-4 font-semibold flex items-center justify-center gap-2">
                      <Printer className="w-4 h-4"/> Imprimir / guardar acta
                    </button>
                  </section>

                  {canSatisfaction && (
                    <section className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 p-4">
                      <div className="flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500"/>
                        <h4 className="font-bold">Satisfacción del cliente</h4>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[1,2,3,4,5].map((value) => (
                          <button key={value} type="button" onClick={() => setRating(value)} className={`w-11 h-11 rounded-xl font-bold ${Number(rating) === value ? 'bg-amber-500 text-white' : 'border border-amber-300 text-amber-700 dark:text-amber-300'}`}>
                            {value}
                          </button>
                        ))}
                      </div>
                      <label className="mt-3 flex items-center gap-3">
                        <input type="checkbox" checked={wouldRecommend} onChange={(e) => setWouldRecommend(e.target.checked)} className="w-5 h-5"/>
                        <span className="text-sm font-semibold">El cliente recomendaría el servicio</span>
                      </label>
                      <textarea rows={3} value={satisfactionComment} onChange={(e) => setSatisfactionComment(e.target.value)} placeholder="Comentario del cliente..." className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"/>
                      <button type="button" disabled={saving} onClick={saveSatisfaction} className="mt-3 w-full sm:w-auto min-h-11 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold px-4">
                        Guardar satisfacción
                      </button>
                    </section>
                  )}
                </>
              )}

              {delivery.status !== 'delivered' && (data?.permissions?.blocking_reasons?.length > 0 || !financialReady) && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500">
                  <p className="font-semibold">Pasos pendientes para confirmar la entrega</p><p className="mt-2">Puedes guardar los datos del receptor y la firma como borrador mientras completas los pasos pendientes.</p>{!financialReady&&<p className="mt-2">{data?.extra_financial?.authorization_pending?'Registra la decisión del cliente sobre el servicio extra pendiente.':'Administración debe revisar los cobros de servicios extra antes de confirmar la entrega.'}</p>}
                  {service.authorization_status==='pending'&&<p className="mt-2">Está pendiente la decisión del cliente sobre la autorización solicitada. {onOpenAuthorization&&<button type="button" onClick={()=>onOpenAuthorization(service)} className="underline">Revisar autorización</button>}</p>}
                  {(data?.permissions?.blocking_reasons || ['Carga de nuevo la orden para consultar los pasos pendientes.']).map((reason,index)=><p key={index} className="mt-2">{reason}</p>)}
                  {!closureReady&&onOpenClosure&&<button type="button" onClick={()=>onOpenClosure(service)} className="mt-3 min-h-11 rounded-xl border px-4 font-semibold">Abrir cierre técnico</button>}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 dark:border-slate-800 p-3 sm:p-4 bg-white dark:bg-slate-900">
          <button type="button" onClick={onClose} className="w-full sm:w-auto min-h-11 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-semibold px-5">
            Cerrar
          </button>
        </footer>
      </section>
      {showExtraPayment&&<FinancialControlModal extraOnly service={service} isAdmin={isAdmin} onClose={()=>setShowExtraPayment(false)} onRefresh={load}/>}
    </div>
  );
}
