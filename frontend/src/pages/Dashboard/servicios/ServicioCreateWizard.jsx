import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Search,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  ShieldCheck,
  UserRound,
  Wrench,
  UsersRound,
  UserCheck,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import api from '../../../services/api';
import ServiceTypePicker from './components/ServiceTypePicker';
import {summarizeServiceTypes} from './serviceTypeSelection';
import ServiceInventoryRequirements from './components/ServiceInventoryRequirements';
import InvoiceRecord from './components/InvoiceRecord';
import IntakeInvoicePicker from './components/IntakeInvoicePicker';
import {IntakePhotos,IntakeAcceptance} from './components/IntakeCreationDocuments';
import {uploadIntakeFiles} from './intakeCreationFiles';
import ServiceSiteFields from './components/ServiceSiteFields';
import {emptyServiceSite,serviceSiteError} from './serviceLocation';
import AcceptanceEvidenceFiles from './components/AcceptanceEvidenceFiles';
import {uploadAcceptanceFiles} from './acceptanceFiles';
import { bogotaDateInput } from './serviceFormatters';
import EquipmentIntakeList,{emptyEquipmentList} from './components/EquipmentIntakeList';
import { equipmentIntakeError } from './components/EquipmentIntakeFields';

const DEFAULT_CONDITIONS =
  'El cliente fue informado del alcance inicial del servicio, tiempos estimados, posibles costos adicionales y de que cualquier reparación o repuesto adicional requerirá autorización previa.';

const DEFAULT_ADDITIONAL_NOTICE =
  'Los valores adicionales que surjan del diagnóstico no serán ejecutados sin autorización del cliente.';

function clientName(client) {
  if (!client) return '';
  if (client.display_name) return client.display_name;
  if (client.tipo_persona === 'juridica') {
    return client.razon_social || 'Cliente';
  }
  return (
    [client.primer_nombre, client.primer_apellido].filter(Boolean).join(' ') ||
    'Cliente'
  );
}

function money(value) {
  if (value === '' || value === null || value === undefined) return '';
  return Number(value).toLocaleString('es-CO');
}

const steps = [
  ['Solicitud', UserRound],
  ['Equipo recibido', ClipboardList],
  ['Clasificación', Wrench],
  ['Condiciones', ClipboardList],
  ['Aceptación', ShieldCheck],
  ['Equipo técnico', UsersRound],
  ['Facturación', CreditCard],
];

export default function ServicioCreateWizard({
  isOpen,
  onClose,
  onCreated,
  onSaved,
  userRole = 'usuario',
  mode = 'create',
  serviceId = null,
  service = null,
}) {
  const isAdmin = userRole === 'admin';
  const isEdit = mode === 'edit' && Boolean(serviceId || service?.id);
  const targetServiceId = serviceId || service?.id || null;
  const [step, setStep] = useState(0);
  const [clientQuery, setClientQuery] = useState('');
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null);
  const [completeProfile,setCompleteProfile]=useState(null);
  const [profileLoading,setProfileLoading]=useState(false);
  const [profileError,setProfileError]=useState('');
  const [profileRetry,setProfileRetry]=useState(0);
  const [ingressPhotos,setIngressPhotos]=useState([]),[savedPhotos,setSavedPhotos]=useState([]);
  const [invoiceFile,setInvoiceFile]=useState(null);
  const [invoiceLinked,setInvoiceLinked]=useState(null);
  const [invoiceChanged,setInvoiceChanged]=useState(false);
  const [acceptanceSignature,setAcceptanceSignature]=useState(''),[signedRevision,setSignedRevision]=useState(''),[acceptanceAct,setAcceptanceAct]=useState(null);
  const profileCache=useRef(new Map());

  // V7_CLIENT_SWITCH
  const isEditMode = mode === 'edit';
  const canChangeClient = isAdmin && isEditMode;

  const [acceptanceClientQuery, setAcceptanceClientQuery] = useState('');
  const [acceptanceClients, setAcceptanceClients] = useState([]);
  const [selectedAcceptanceClient, setSelectedAcceptanceClient] = useState(null);
  const [loadingAcceptanceClients, setLoadingAcceptanceClients] = useState(false);
  const [acceptanceClientTouched, setAcceptanceClientTouched] = useState(false);

  const [types, setTypes] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [technicianSearch, setTechnicianSearch] = useState('');
  const [primaryTechnicianId, setPrimaryTechnicianId] = useState('');
  const [supportTechnicianIds, setSupportTechnicianIds] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [saving, setSaving] = useState(false);
  const [acceptanceFiles, setAcceptanceFiles] = useState([]);
  const createdIntakeRef = useRef(null);
  const uploadEvidence = async (id) => uploadAcceptanceFiles(id, acceptanceFiles, key => setAcceptanceFiles(files => files.filter(file => file.key !== key)));
  const [error, setError] = useState('');
  const [paymentVerified, setPaymentVerified] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('transfer');
  const [paymentReference, setPaymentReference] = useState('');
  const [schedulingMode, setSchedulingMode] = useState('auto');
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [editDetail, setEditDetail] = useState(null);
  const initialEditSnapshot = useRef(null);

  const [form, setForm] = useState({
    service_site: emptyServiceSite(),
    equipment_intake: emptyEquipmentList(),
    request_description: '',
    classification: 'diagnostic',
    service_type_id: '',
    service_type_ids: [],
    service_type_name: '',
    service_type_category: '',
    base_value: '',
    estimated_minutes: 60,
    scope_text: '',
    conditions_text: DEFAULT_CONDITIONS,
    additional_costs_notice: DEFAULT_ADDITIONAL_NOTICE,
    client_acceptance: false,
    client_acceptance_client_id: '',
    client_acceptance_name: '',
    client_acceptance_document: '',
    client_acceptance_channel: 'whatsapp',
    client_acceptance_reference: '',
    billing_mode: 'prepaid',
    invoice_reference: '',
    postpaid_reason: '',
    priority: 'normal',
    estimated_duration: 60,
    scheduled_date: '',
    scheduled_time: '09:00',
  });

  useEffect(() => {
    if (!isOpen) { createdIntakeRef.current = null; setAcceptanceFiles([]);setIngressPhotos([]);setSavedPhotos([]);setInvoiceFile(null);setAcceptanceSignature('');setSignedRevision('');setAcceptanceAct(null); }
  }, [isOpen]);

  const selectedClientId=selectedClient?.id, selectedClientOrigin=selectedClient?.origen;
  useEffect(() => {
    if(!isOpen||!selectedClientId){setProfileLoading(false);return;}
    const controller=new AbortController();let active=true;
    const key=(selectedClientOrigin||'local')+':'+selectedClientId;
    const apply=profile=>{if(!active)return;setCompleteProfile(profile);setSelectedClient(previous=>previous?.id===profile.id?{...previous,...profile}:previous);if(!isEdit)setForm(previous=>({...previous,service_site:{...previous.service_site,address:previous.service_site.address||profile.direccion||'',city:previous.service_site.city||profile.ciudad||'',contact_name:previous.service_site.contact_name||profile.contacto||clientName(profile),contact_phone:previous.service_site.contact_phone||profile.telefono||profile.telefono_2||''}}));};
    setProfileError('');
    if(profileCache.current.has(key)&&profileRetry===0){apply(profileCache.current.get(key));setProfileLoading(false);return()=>{active=false;};}
    setProfileLoading(true);
    api.get(`/api/clients/${selectedClientId}/summary`,{signal:controller.signal,params:{origin:selectedClientOrigin||'local'}}).then(response=>{const profile=response.data?.data;profileCache.current.set(key,profile);apply(profile);}).catch(e=>{if(active&&e.code!=='ERR_CANCELED')setProfileError(e.response?.data?.message||'No se pudo actualizar el contacto. Puedes completar los datos de atención.');}).finally(()=>{if(active)setProfileLoading(false);});
    return()=>{active=false;controller.abort();};
  },[isOpen,selectedClientId,selectedClientOrigin,profileRetry,isEdit]);

  useEffect(() => {
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

  useEffect(() => {
    if (!isOpen) return undefined;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    api
      .get('/api/tipos-servicio')
      .then((response) => {
        const rows = Array.isArray(response.data) ? response.data : [];
        setTypes(rows.filter((item) => item.activo !== false));
      })
      .catch(() => setTypes([]));

    if (isAdmin) {
      api
        .get('/api/usuarios/role/tecnico')
        .then((response) => {
          const rows = Array.isArray(response.data)
            ? response.data
            : response.data?.data || [];
          setTechnicians(rows.filter((item) => item.activo !== false));
        })
        .catch(() => setTechnicians([]));
    }

    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !isEdit || !targetServiceId) return undefined;

    let active = true;

    const loadExisting = async () => {
      try {
        setLoadingExisting(true);
        setError('');

        const response = await api.get(`/api/service-orders/${targetServiceId}`);
        const row = response.data?.data || response.data;
        if (!active || !row) return;

        const intake = row.intake || {};
        const documents=await api.get(`/api/service-orders/${targetServiceId}/creation-documents`);
        if(!active)return;
        setInvoiceChanged(false);
        setInvoiceLinked(documents.data?.invoice?{reference:documents.data.invoice.invoice_reference,record:documents.data.invoice.record}:null);
        const currentTeam = Array.isArray(row.equipo) ? row.equipo : [];

        const client = {
          id: row.client_id,
          tipo_persona: row.cliente_tipo_persona || null,
          razon_social: row.cliente_razon_social || null,
          primer_nombre: row.cliente_primer_nombre || null,
          segundo_nombre: row.cliente_segundo_nombre || null,
          primer_apellido: row.cliente_primer_apellido || null,
          segundo_apellido: row.cliente_segundo_apellido || null,
          documento: row.cliente_documento || null,
          telefono: row.cliente_telefono || null,
          email: row.cliente_email || null,
          direccion: row.cliente_direccion || null,
          ciudad: row.cliente_ciudad || null,
          display_name: row.cliente_nombre || null,
          origen: 'local',
        };

        setSelectedClient(client);
        setClientQuery(clientName(client));
        setClients([]);

        const acceptance = intake.client_acceptance
          ? {
              id: intake.client_acceptance_client_id || row.client_id,
              documento: intake.client_acceptance_document || row.cliente_documento || '',
              display_name: intake.client_acceptance_name || row.cliente_nombre || 'Cliente',
              origen: 'local',
            }
          : null;

        setSelectedAcceptanceClient(acceptance);
        setAcceptanceClientQuery(acceptance ? clientName(acceptance) : '');
        setAcceptanceClientTouched(Boolean(acceptance));

        const primary = currentTeam.find((item) => item.member_role === 'primary');
        const supports = currentTeam
          .filter((item) => item.member_role !== 'primary')
          .map((item) => item.technician_id);

        setPrimaryTechnicianId(primary?.technician_id || row.tecnico_id || '');
        setSupportTechnicianIds(supports);

        const modeValue = intake.scheduling_mode || row.scheduling_mode || 'auto';
        const dateValue = String(row.fecha_agendada || intake.scheduled_date || '').slice(0, 10);
        const timeValue = String(row.hora_inicio_agendada || intake.scheduled_time || '09:00').slice(0, 5);
        const durationValue = Number(row.duracion_estimada || intake.estimated_duration || intake.estimated_minutes || 60);

        setSchedulingMode(modeValue);
        setPaymentVerified(intake.payment_status === 'verified');
        setPaymentMethod(intake.payment_method || 'transfer');
        setPaymentReference(intake.payment_reference || '');

        setForm({
          service_site: row.service_site || intake.service_site || null,
          equipment_intake: intake.equipment_intake || null,
          request_description: intake.request_description || row.descripcion_inicial || '',
          classification: intake.classification || row.classification || 'diagnostic',
          service_type_id: intake.service_type_id || row.service_type_id || '',
          service_type_ids: intake.service_types?.length?intake.service_types.map(t=>t.id):(row.servicios?.length?row.servicios.map(t=>t.tipo_servicio_id).filter(Boolean):[intake.service_type_id||row.service_type_id].filter(Boolean)),
          service_type_name: intake.service_type_name || row.service_type_name || '',
          service_type_category: intake.service_type_category || row.service_type_category || '',
          base_value: intake.base_value ?? '',
          estimated_minutes: Number(intake.estimated_minutes || durationValue || 60),
          scope_text: intake.scope_text || '',
          conditions_text: intake.conditions_text || DEFAULT_CONDITIONS,
          additional_costs_notice: intake.additional_costs_notice || DEFAULT_ADDITIONAL_NOTICE,
          client_acceptance: Boolean(intake.client_acceptance),
          client_acceptance_client_id: intake.client_acceptance_client_id || row.client_id || '',
          client_acceptance_name: intake.client_acceptance_name || row.cliente_nombre || '',
          client_acceptance_document: intake.client_acceptance_document || row.cliente_documento || '',
          client_acceptance_channel: intake.client_acceptance_channel || 'whatsapp',
          client_acceptance_reference: intake.client_acceptance_reference || '',
          billing_mode: intake.billing_mode || row.billing_mode || 'prepaid',
          invoice_reference: intake.invoice_reference || row.invoice_reference || '',
          postpaid_reason: intake.postpaid_reason || '',
          priority: intake.priority || row.prioridad || 'normal',
          estimated_duration: durationValue,
          scheduled_date: dateValue,
          scheduled_time: timeValue,
        });

        const teamSignature = JSON.stringify([
          primary?.technician_id || row.tecnico_id || '',
          ...supports.slice().sort(),
        ]);

        initialEditSnapshot.current = {
          schedulingMode: modeValue,
          scheduledDate: dateValue,
          scheduledTime: timeValue,
          duration: durationValue,
          teamSignature,
          paymentStatus: intake.payment_status || null,
          intakeId: intake.id || null,
        };

        setEditDetail(row);
        setStep(0);
      } catch (requestError) {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              'No fue posible cargar el servicio para editarlo'
          );
        }
      } finally {
        if (active) setLoadingExisting(false);
      }
    };

    loadExisting();

    return () => {
      active = false;
    };
  }, [isOpen, isEdit, targetServiceId]);

  useEffect(() => {
    if (!isOpen) return;

    const controller=new AbortController();
    const timer = window.setTimeout(async () => {
      const q = clientQuery.trim();
      if (selectedClient && q === clientName(selectedClient)) {
        setClients([]);
        return;
      }
      if (q.length < 2) {
        setClients([]);
        return;
      }

      try {
        setLoadingClients(true);
        const response = await api.get('/api/clients/search', {
          params: { q },signal:controller.signal,
        });
        if(!controller.signal.aborted)setClients(Array.isArray(response.data) ? response.data : []);
      } catch {
        if(!controller.signal.aborted)setClients([]);
      } finally {
        if(!controller.signal.aborted)setLoadingClients(false);
      }
    }, 250);

    return () => {window.clearTimeout(timer);controller.abort();};
  }, [clientQuery, isOpen, selectedClient]);

  useEffect(() => {
    if (!isOpen || !form.client_acceptance) return undefined;

    const controller=new AbortController();
    const timer = window.setTimeout(async () => {
      const q = acceptanceClientQuery.trim();

      if (
        selectedAcceptanceClient &&
        q === clientName(selectedAcceptanceClient)
      ) {
        setAcceptanceClients([]);
        return;
      }

      if (q.length < 2) {
        setAcceptanceClients([]);
        return;
      }

      try {
        setLoadingAcceptanceClients(true);

        const response = await api.get('/api/clients/search', {
          params: { q },signal:controller.signal,
        });

        setAcceptanceClients(
          Array.isArray(response.data)
            ? response.data
            : []
        );
      } catch {
        setAcceptanceClients([]);
      } finally {
        setLoadingAcceptanceClients(false);
      }
    }, 250);

    return () => {window.clearTimeout(timer);controller.abort();};
  }, [
    acceptanceClientQuery,
    form.client_acceptance,
    isOpen,
    selectedAcceptanceClient,
  ]);

  const typeCatalog=useMemo(()=>{const saved=editDetail?.intake?.service_types||[];return [...types.map(t=>saved.find(x=>x.id===t.id)||t),...saved.filter(t=>!types.some(x=>x.id===t.id))];},[types,editDetail]);
  const selectedTypes = useMemo(()=>typeCatalog.filter(t=>(form.service_type_ids||[form.service_type_id]).includes(t.id)),[typeCatalog,form.service_type_ids,form.service_type_id]);
  const selectionSummary=useMemo(()=>summarizeServiceTypes(selectedTypes),[selectedTypes]);
  const selectedType=selectedTypes.length?{nombre:selectionSummary.service_type_name,categoria:selectionSummary.service_type_category,valor_base:selectionSummary.base_value,duracion_estimada:selectionSummary.estimated_minutes,inventory_requirements:selectionSummary.inventory_requirements}:null;

  const filteredTechnicians = useMemo(() => {
    const term = technicianSearch.trim().toLowerCase();
    if (!term) return technicians;
    return technicians.filter((item) => {
      const name = [
        item.nombre1,
        item.nombre2,
        item.apellidos,
        item.usuario,
        item.cedula,
        item.celular,
        item.email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return name.includes(term);
    });
  }, [technicianSearch, technicians]);

  const selectedPrimary = useMemo(
    () => technicians.find((item) => item.id === primaryTechnicianId) || null,
    [technicians, primaryTechnicianId]
  );

  const update = (key, value) => {
    if(['request_description','classification','base_value','estimated_minutes','estimated_duration','scope_text','conditions_text','additional_costs_notice','service_site','client_acceptance_name','client_acceptance_document','client_acceptance'].includes(key)&&form[key]!==value){setAcceptanceSignature('');setSignedRevision('');setAcceptanceAct(null);}
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const chooseAcceptanceClient = (
    client,
    { manual = true } = {}
  ) => {
    if(manual){setAcceptanceSignature('');setSignedRevision('');setAcceptanceAct(null);}
    if (!client) {
      setSelectedAcceptanceClient(null);
      setAcceptanceClientQuery('');
      setAcceptanceClients([]);

      if (manual) {
        setAcceptanceClientTouched(true);
      }

      setForm((previous) => ({
        ...previous,
        client_acceptance_client_id: '',
        client_acceptance_name: '',
        client_acceptance_document: '',
      }));

      return;
    }

    setSelectedAcceptanceClient(client);
    setAcceptanceClientQuery(clientName(client));
    setAcceptanceClients([]);

    if (manual) {
      setAcceptanceClientTouched(true);
    }

    setForm((previous) => ({
      ...previous,
      client_acceptance_client_id:
        client.id || '',

      client_acceptance_origin:
        client.origen ||
        (client.id_externo ? 'melissa' : 'local'),

      client_acceptance_external_id:
        client.id_externo || null,

      client_acceptance_snapshot: {
        id:
          client.id || null,
        id_externo:
          client.id_externo || null,
        origen:
          client.origen ||
          (client.id_externo ? 'melissa' : 'local'),
        tipo_persona:
          client.tipo_persona || null,
        documento:
          client.documento || null,
        razon_social:
          client.razon_social || null,
        primer_nombre:
          client.primer_nombre || null,
        segundo_nombre:
          client.segundo_nombre || null,
        primer_apellido:
          client.primer_apellido || null,
        segundo_apellido:
          client.segundo_apellido || null,
        telefono:
          client.telefono || null,
        email:
          client.email || null,
        direccion:
          client.direccion || null,
        ciudad:
          client.ciudad || null,
      },

      client_acceptance_name:
        clientName(client),

      client_acceptance_document:
        client.documento || '',
    }));
  };

  const chooseType = (id,createdType=null) => {
    setAcceptanceSignature('');setSignedRevision('');setAcceptanceAct(null);
    const catalog=createdType?[...typeCatalog,createdType]:typeCatalog;
    setForm(previous=>{
      const ids=previous.service_type_ids||[previous.service_type_id].filter(Boolean);
      const next=ids.includes(id)?ids.filter(v=>v!==id):[...ids,id];
      const selected=next.map(id=>catalog.find(t=>t.id===id)).filter(Boolean);
      return {...previous,...summarizeServiceTypes(selected),scope_text:previous.scope_text||selected.map(t=>t.descripcion).filter(Boolean).join('\n')};
    });
  };

  const acceptanceRevision=JSON.stringify([form.equipment_intake,form.service_type_ids,selectedClient?.id,form.request_description,form.classification,form.service_type_name,form.base_value,form.estimated_minutes,form.scope_text,form.conditions_text,form.additional_costs_notice,form.service_site,form.client_acceptance_name,form.client_acceptance_document]);
  const ensureDraft=async()=>{
    if(!selectedClient)throw new Error('Selecciona el cliente.');
    for(const n of [0,1,2,3]){const issue=validateStep(n);if(issue)throw new Error(issue);}
    const payload={...form,client_id:selectedClient.id,client_origin:selectedClient.origen||'local',client_external_id:selectedClient.id_externo||null,source_type:isAdmin?'customer':'technician',scheduling_mode:'auto',team:[],base_value:form.base_value===''?null:Number(form.base_value),estimated_minutes:Number(form.estimated_minutes||60),estimated_duration:Number(form.estimated_duration||60)};
    let intake=createdIntakeRef.current;
    if(!intake){const r=await api.post('/api/service-orders/intakes',payload);intake=r.data.data;createdIntakeRef.current=intake;}else if(intake.status!=='activated'){await api.put(`/api/service-orders/intakes/${intake.id}`,payload);}
    if(!intake?.id)throw new Error('No se recibió la solicitud.');
    return intake;
  };
  const removeSavedPhoto=async id=>{try{await api.delete(`/api/service-orders/intakes/${createdIntakeRef.current.id}/creation-documents/${id}`);setSavedPhotos(p=>p.filter(f=>f.id!==id));}catch(e){setError(e.response?.data?.message||'No se pudo quitar la foto.');}};
  const uploadCreationFiles=async id=>{await uploadIntakeFiles(id,ingressPhotos,'reception_photo',key=>setIngressPhotos(p=>p.filter(f=>f.key!==key)));if(invoiceFile){await uploadIntakeFiles(id,[invoiceFile],'invoice_support',()=>setInvoiceFile(null));}const r=await api.get(`/api/service-orders/intakes/${id}/creation-documents`);setSavedPhotos((r.data.files||[]).filter(f=>f.kind==='reception_photo').map(f=>({...f,intake_id:id})));};

  const validateStep = (targetStep=step) => {
    setError('');

    if (targetStep === 0) {
      if (!selectedClient) return 'Selecciona el cliente.';

      const siteError=serviceSiteError(form.service_site);if(siteError)return siteError;
      if (!form.request_description.trim()) {
        return 'Describe la necesidad o solicitud del cliente.';
      }
    }

    if (targetStep === 1 && !isEdit) {
      const equipmentError = equipmentIntakeError(form.equipment_intake);
      if (equipmentError) return equipmentError;
    }

    if (targetStep === 2) {
      if (!form.classification) return 'Selecciona la clasificación.';
      if (!form.service_type_name.trim()) {
        return 'Selecciona un tipo de servicio.';
      }
    }

    if (targetStep === 3) {
      if (!form.scope_text.trim()) return 'Define el alcance inicial.';
      if (!form.conditions_text.trim()) {
        return 'Registra las condiciones informadas al cliente.';
      }
    }

    if (targetStep === 4) {
      if(!isEdit&&signedRevision!==acceptanceRevision)return 'Firma y genera el acta de aceptación con las condiciones vigentes.';
      if (!form.client_acceptance) {
        return 'Debes registrar la aceptación inicial del cliente.';
      }
      if (!selectedAcceptanceClient && !selectedClient) {
        return 'Selecciona la persona que acepta.';
      }

      if (!form.client_acceptance_document.trim()) {
        return 'La persona que acepta debe tener documento registrado.';
      }
      if (!form.client_acceptance_channel) {
        return 'Selecciona el canal de aceptación.';
      }
    }

    if (targetStep === 5) {
      if (isAdmin && !primaryTechnicianId) {
        return 'Selecciona el técnico responsable principal.';
      }
      if (schedulingMode === 'manual' && !form.scheduled_date) {
        return 'Para programación manual, selecciona una fecha.';
      }
      if (schedulingMode === 'manual' && !form.scheduled_time) {
        return 'Para programación manual, selecciona una hora.';
      }
    }

    if (targetStep === 6 && form.billing_mode === 'prepaid') {
      if (isAdmin && paymentVerified && !paymentReference.trim()) {
        return 'Registra la referencia o soporte del pago.';
      }
    }

    if (targetStep === 6 && form.billing_mode === 'postpaid') {
      if (!isAdmin) return 'Solo administración puede autorizar pospago.';
      if (!form.postpaid_reason.trim()) {
        return 'Indica por qué este servicio se manejará como pospago.';
      }
    }

    return null;
  };

  const goNext = () => {
    const message = validateStep();
    if (message) {
      setError(message);
      return;
    }
    setStep((value) => Math.min(value + 1, steps.length - 1));
  };

  const submit = async () => {
    const message = [0,1,2,3,4,5,6].map(n=>validateStep(n)).find(Boolean) || serviceSiteError(form.service_site) || (!isEdit && equipmentIntakeError(form.equipment_intake));
    if (message) {
      setError(message);
      return;
    }

    try {
      setSaving(true);
      setError('');
      if(isAdmin&&schedulingMode==='manual'){
        const r=await api.post('/api/service-orders/creation-availability',{date:form.scheduled_date,time:form.scheduled_time,typeIds:form.service_type_ids,typeId:form.service_type_id,technicians:[primaryTechnicianId,...supportTechnicianIds],excludeOrder:isEdit?targetServiceId:null});
        if(!r.data.available)throw new Error(r.data.technicians.filter(t=>!t.available).map(t=>{const tech=technicians.find(x=>x.id===t.technician_id);return [tech?.nombre1,tech?.apellidos].filter(Boolean).join(' ')+': '+t.reason;}).join(' '));
      }

      const teamPayload = isAdmin
        ? [
            ...(primaryTechnicianId
              ? [{ technician_id: primaryTechnicianId, member_role: 'primary' }]
              : []),
            ...supportTechnicianIds.map((technicianId) => ({
              technician_id: technicianId,
              member_role: 'support',
            })),
          ]
        : [];

      if (isEdit) {
        const currentTeamSignature = JSON.stringify([
          primaryTechnicianId || '',
          ...supportTechnicianIds.slice().sort(),
        ]);
        const initial = initialEditSnapshot.current || {};
        const scheduleChanged =
          initial.schedulingMode !== schedulingMode ||
          initial.scheduledDate !== (form.scheduled_date || '') ||
          initial.scheduledTime !== (form.scheduled_time || '') ||
          Number(initial.duration || 0) !== Number(form.estimated_duration || 0) ||
          initial.teamSignature !== currentTeamSignature;

        const updateResponse = await api.put(
          `/api/service-orders/${targetServiceId}`,
          {
            client_id: selectedClient?.id || null,
            ...(form.service_site?{service_site:form.service_site}:{}),
            request_description: form.request_description,
            descripcion_inicial: form.request_description,
            classification: form.classification,
            service_type_id: form.service_type_id || null,
            ...(form.service_type_ids?.length?{service_type_ids:form.service_type_ids}:{}),
            service_type_name: form.service_type_name,
            service_type_category: form.service_type_category,
            base_value: form.base_value === '' ? null : Number(form.base_value),
            estimated_minutes: form.estimated_minutes
              ? Number(form.estimated_minutes)
              : null,
            scope_text: form.scope_text,
            conditions_text: form.conditions_text,
            additional_costs_notice: form.additional_costs_notice,
            client_acceptance: form.client_acceptance,
            client_acceptance_client_id: form.client_acceptance_client_id || null,
            client_acceptance_name: form.client_acceptance_name,
            client_acceptance_document: form.client_acceptance_document,
            client_acceptance_channel: form.client_acceptance_channel,
            client_acceptance_reference: form.client_acceptance_reference,
            billing_mode: form.billing_mode,
            invoice_reference: form.invoice_reference,
            ...(invoiceChanged&&invoiceLinked?.record?.source_company&&invoiceLinked?.record?.source_id?{worldoffice_invoice:{reference:invoiceLinked.reference,source_company:invoiceLinked.record.source_company,source_id:invoiceLinked.record.source_id}}:{}),
            postpaid_reason: form.postpaid_reason,
            priority: form.priority,
            estimated_duration: form.estimated_duration
              ? Number(form.estimated_duration)
              : 60,
            duracion_estimada: form.estimated_duration
              ? Number(form.estimated_duration)
              : 60,
            scheduling_mode: schedulingMode,
            scheduled_date:
              schedulingMode === 'manual' ? form.scheduled_date || null : null,
            scheduled_time:
              schedulingMode === 'manual' ? form.scheduled_time || null : null,
            team: teamPayload,
            reschedule: scheduleChanged,
          }
        );

        const intakeId = initial.intakeId || editDetail?.intake?.id;
        if (
          isAdmin &&
          form.billing_mode === 'prepaid' &&
          paymentVerified &&
          initial.paymentStatus !== 'verified' &&
          intakeId
        ) {
          await api.post(`/api/service-orders/intakes/${intakeId}/verify-payment`, {
            invoice_reference: form.invoice_reference,
            payment_method: paymentMethod,
            payment_reference: paymentReference,
          });
        }

        if (intakeId) await uploadEvidence(intakeId);

        if (updateResponse.data?.schedule_warning) {
          setError(
            `Cambios guardados. La programación automática quedó pendiente: ${updateResponse.data.schedule_warning}`
          );
          await onSaved?.();
          return;
        }

        await onSaved?.();
        onClose();
        return;
      }

      const intakePayload = {
        client_id: selectedClient.id,
        client_origin: selectedClient.origen || 'local',
        client_external_id: selectedClient.id_externo || null,
        client_key: selectedClient.cliente_key || null,
        source_type: isAdmin ? 'customer' : 'technician',
        created_from_technician: !isAdmin,
        ...form,
        scheduled_date: schedulingMode === 'manual' ? form.scheduled_date : null,
        scheduled_time: schedulingMode === 'manual' ? form.scheduled_time : null,
        scheduling_mode: schedulingMode,
        team: teamPayload,
        base_value: form.base_value === '' ? null : Number(form.base_value),
        estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
        estimated_duration: form.estimated_duration ? Number(form.estimated_duration) : null,
      };
      let intake = createdIntakeRef.current;
      if (!intake) {
        const createResponse = await api.post('/api/service-orders/intakes', intakePayload);
        intake = createResponse.data?.data;
        if (intake?.id) createdIntakeRef.current = intake;
      } else if (intake.status !== 'activated') {
        await api.put(`/api/service-orders/intakes/${intake.id}`, intakePayload);
      }

      if (!intake?.id) {
        throw new Error('No se recibió el ID de la solicitud');
      }

      await uploadEvidence(intake.id);
      await uploadCreationFiles(intake.id);

      if (isAdmin && form.billing_mode === 'prepaid' && paymentVerified) {
        await api.post(`/api/service-orders/intakes/${intake.id}/verify-payment`, {
          invoice_reference: form.invoice_reference,
          payment_method: paymentMethod,
          payment_reference: paymentReference,
        });
      }

      if (isAdmin) {
        try {
          const activateResponse = intake.status === 'activated'
            ? {data:{data:{id:intake.service_order_id}}}
            : await api.post(`/api/service-orders/intakes/${intake.id}/activate`).catch(error => {
                if (error.response?.data?.code === 'INTAKE_ALREADY_ACTIVATED') {
                  return {data:{data:{id:error.response.data.service_order_id}}};
                }
                throw error;
              });

          const order = activateResponse.data?.data || null;
          createdIntakeRef.current = {...intake, status:'activated', service_order_id:order?.id};

          if (order?.id && primaryTechnicianId) {
            await api.patch(`/api/service-orders/${order.id}/approve`, {
              observaciones: 'Creada y asignada desde el flujo controlado',
            });

            if (schedulingMode === 'manual') {
              await api.put(`/api/agenda/servicio/${order.id}`, {
                fecha_agendada: form.scheduled_date,
                hora_inicio: form.scheduled_time,
                duracion_estimada: Number(form.estimated_duration || 60),
              });
            }
          }
        } catch (activateError) {
          if (activateError.response?.data?.code !== 'INTAKE_NOT_READY') {
            throw activateError;
          }

          const missing = activateError.response?.data?.missing || [];
          setError(
            `Solicitud guardada, pero aún no puede crear la OS. Falta: ${missing.join(
              ', '
            )}`
          );
          await onCreated?.();
          return;
        }
      }

      await onCreated?.();
      onClose();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          (isEdit ? 'No fue posible guardar los cambios' : 'No fue posible registrar el servicio')
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="workflow-theme fixed inset-0 z-[110] bg-black/60 sm:p-4 flex items-stretch sm:items-center justify-center">
      <section className="w-full h-[100dvh] sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl bg-white dark:bg-gray-900 sm:rounded-2xl shadow-2xl flex flex-col min-h-0 overflow-hidden">
        <header className="shrink-0 border-b border-gray-200 dark:border-gray-800 px-4 sm:px-6 py-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide accent-text">
              {isEdit ? 'Edición controlada de servicio' : 'Creación controlada de servicio'}
            </p>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isEdit ? `Editar ${editDetail?.codigo_os || service?.codigo_os || 'Orden de Servicio'}` : 'Nueva Orden de Servicio'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {isEdit
                ? 'Mismos datos de creación, precargados para edición segura.'
                : 'Solicitud → equipo recibido → clasificación → condiciones → aceptación → facturación.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="shrink-0 border-b border-gray-100 dark:border-gray-800 overflow-x-auto">
          <div className="min-w-max px-4 sm:px-6 py-3 flex gap-2">
            {steps.map(([label, Icon], index) => (
              <button
                type="button" onClick={()=>{setError('');setStep(index);}} disabled={saving}
                key={label}
                className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold ${
                  index === step
                    ? 'accent-fill text-white'
                    : index < step
                      ? 'accent-soft accent-text dark:accent-soft dark:accent-text'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {React.createElement(Icon,{className:"w-4 h-4"})}
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6 py-5"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {loadingExisting && (
            <div className="mb-4 rounded-xl border accent-border dark:accent-border accent-soft dark:accent-soft p-3 text-sm accent-text dark:accent-text">
              Cargando todos los datos del servicio...
            </div>
          )}

          {step === 0 && (
            <div className="space-y-5">
              <div>
                <label className="text-sm font-semibold">Buscar cliente *</label>
                <div className="relative mt-1">
                  <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                  <input
                    value={clientQuery}
                    onChange={(event) => setClientQuery(event.target.value)}
                    placeholder="Nombre, documento o teléfono"
                    className="w-full min-h-12 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-10 pr-3"
                  />
                </div>

                {selectedClient && (
                  <div className="mt-3 rounded-xl border accent-border dark:accent-border accent-soft dark:accent-soft p-3">
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
                )}

                {!selectedClient && (
                  <div className="mt-2 space-y-2">
                    {loadingClients && (
                      <p className="text-sm text-gray-500">Buscando...</p>
                    )}
                    {clients.map((client) => (
                      <button
                        key={client.id}
                        type="button"
                        onClick={() => {
                          setSelectedClient(client);setCompleteProfile(client);setProfileRetry(0);setInvoiceChanged(false);setInvoiceLinked(null);setInvoiceFile(null);update('invoice_reference','');
                          setForm(previous=>({...previous,equipment_intake:{...previous.equipment_intake,received_from_name:clientName(client),received_from_document:client.documento||'',...(previous.equipment_intake?.equipments?{equipments:previous.equipment_intake.equipments.map(item=>({...item,received_from_name:clientName(client),received_from_document:client.documento||''}))}:{})},service_site:{...emptyServiceSite(),mode:previous.service_site.mode,address:client.direccion||'',city:client.ciudad||'',contact_name:client.contacto||clientName(client),contact_phone:client.telefono||client.telefono_2||''}}));
                          setSignedRevision('');setAcceptanceAct(null);setAcceptanceSignature('');setSavedPhotos([]);createdIntakeRef.current=null;

                          setClientQuery(clientName(client));
                          setClients([]);

                          if (
                            !acceptanceClientTouched ||
                            !selectedAcceptanceClient
                          ) {
                            chooseAcceptanceClient(
                              client,
                              { manual: false }
                            );
                          }
                        }}
                        className="w-full rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                      >
                        <span className="font-semibold block">
                          {clientName(client)}
                        </span>
                        <span className="text-xs text-gray-500">
                          {client.documento || 'Sin documento'} ·{' '}
                          {client.telefono || 'Sin teléfono'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedClient && <section className="rounded-xl border p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm" aria-label="Datos del cliente">{[['Cliente',clientName(completeProfile||selectedClient)],['Identificación',(completeProfile||selectedClient).documento],['Teléfono',(completeProfile||selectedClient).telefono||(completeProfile||selectedClient).telefono_2],['Correo',(completeProfile||selectedClient).email],['Dirección',(completeProfile||selectedClient).direccion],['Ciudad',(completeProfile||selectedClient).ciudad]].map(([label,value])=><p key={label}><span className="text-gray-500">{label}: </span>{value||'Sin dato'}</p>)}{profileLoading&&<p className="text-xs">Actualizando contacto…</p>}{profileError&&<p className="text-xs sm:col-span-2">{profileError} <button type="button" className="underline" onClick={()=>setProfileRetry(x=>x+1)}>Reintentar</button></p>}</section>}
              {selectedClient && <ServiceSiteFields value={form.service_site} onChange={value=>update('service_site',value)} disabled={saving} />}

              <label className="block">
                <span className="text-sm font-semibold">
                  Falla reportada / solicitud del cliente *
                </span>
                <textarea
                  rows={5}
                  value={form.request_description}
                  onChange={(event) =>
                    update('request_description', event.target.value)
                  }
                  placeholder="Ej: Portátil no enciende. Cliente solicita revisión y diagnóstico..."
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className="text-sm font-semibold">Prioridad</span>
                  <select
                    value={form.priority}
                    onChange={(event) => update('priority', event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  >
                    <option value="baja">Baja</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </label>


              </div>
            </div>
          )}

          {step === 1 && (
            isEdit && !form.equipment_intake ? (
              <p className="text-sm text-gray-500">Este servicio se creó antes del registro de equipo en la solicitud. Consulta su checklist de recepción.</p>
            ) : <EquipmentIntakeList value={form.equipment_intake} onChange={value=>update('equipment_intake',value)} readOnly={isEdit} files={ingressPhotos} onPhotosChange={setIngressPhotos} existing={savedPhotos} onRemoveExisting={removeSavedPhoto}/>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => update('classification', 'diagnostic')}
                  className={`min-h-24 rounded-2xl border p-4 text-left ${
                    form.classification === 'diagnostic'
                      ? 'accent-border accent-soft dark:accent-soft'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <p className="font-bold">Revisión / diagnóstico</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Se determina la falla y posteriormente puede requerir
                    autorización adicional.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => update('classification', 'specific')}
                  className={`min-h-24 rounded-2xl border p-4 text-left ${
                    form.classification === 'specific'
                      ? 'accent-border accent-soft dark:accent-soft'
                      : 'border-gray-200 dark:border-gray-800'
                  }`}
                >
                  <p className="font-bold">Servicio específico</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Trabajo conocido con alcance y tarifa definidos.
                  </p>
                </button>
              </div>

              <ServiceTypePicker types={typeCatalog} value={form.service_type_ids||[form.service_type_id].filter(Boolean)} onSelect={chooseType} canCreate={isAdmin} onCreated={type=>{setTypes(previous=>[...previous,type]);chooseType(type.id,type);}} />
              {selectedTypes.length>0&&<><p className="font-semibold">Duración total: {selectionSummary.estimated_minutes} minutos · {selectedTypes.length} tipos seleccionados</p><ServiceInventoryRequirements value={selectionSummary.inventory_requirements}/></>}

              {selectedType && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-950/40 p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Categoría</p>
                    <p className="font-semibold">
                      {selectedType.categoria || 'Sin categoría'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Valor base</p>
                    <p className="font-semibold">
                      {selectedType.valor_base
                        ? `$${money(selectedType.valor_base)}`
                        : 'Por definir'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Duración estimada</p>
                    <p className="font-semibold">
                      {selectedType.duracion_estimada || 60} min
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label>
                  <span className="text-sm font-semibold">Valor inicial</span>
                  <input
                    type="number"
                    min="0"
                    value={form.base_value}
                    onChange={(event) =>
                      update('base_value', event.target.value)
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">
                    Tiempo estimado (min)
                  </span>
                  <input
                    type="number"
                    min="1"
                    value={form.estimated_minutes}
                    onChange={(event) =>
                      update('estimated_minutes', event.target.value)
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-semibold">Alcance inicial *</span>
                <textarea
                  rows={4}
                  value={form.scope_text}
                  onChange={(event) => update('scope_text', event.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">
                  Condiciones informadas *
                </span>
                <textarea
                  rows={6}
                  value={form.conditions_text}
                  onChange={(event) =>
                    update('conditions_text', event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold">
                  Información sobre costos adicionales
                </span>
                <textarea
                  rows={4}
                  value={form.additional_costs_notice}
                  onChange={(event) =>
                    update('additional_costs_notice', event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                />
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <label className="flex items-start gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
                <input
                  type="checkbox"
                  checked={form.client_acceptance}
                  onChange={(event) => {
                    const checked =
                      event.target.checked;

                    update(
                      'client_acceptance',
                      checked
                    );

                    if (
                      checked &&
                      !selectedAcceptanceClient &&
                      selectedClient
                    ) {
                      chooseAcceptanceClient(
                        selectedClient,
                        { manual: false }
                      );
                    }
                  }}
                  className="mt-1 w-5 h-5"
                />
                <span>
                  <span className="font-bold block">
                    El cliente acepta las condiciones iniciales
                  </span>
                  <span className="text-sm text-gray-500">
                    Confirma que comprendió alcance, costos iniciales, tiempos y
                    posibles costos adicionales.
                  </span>
                </span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <span className="text-sm font-semibold">
                    Persona que acepta *
                  </span>

                  <div className="relative mt-1">
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />

                    <input
                      value={acceptanceClientQuery}
                      disabled={!form.client_acceptance}
                      onChange={(event) => {
                        setAcceptanceClientQuery(
                          event.target.value
                        );

                        setSelectedAcceptanceClient(
                          null
                        );

                        setAcceptanceClientTouched(
                          true
                        );

                        setForm((previous) => ({
                          ...previous,
                          client_acceptance_client_id: '',
                          client_acceptance_name: '',
                          client_acceptance_document: '',
                        }));
                      }}
                      placeholder="Buscar por nombre o documento"
                      className="w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-10 pr-3 disabled:opacity-60"
                    />
                  </div>

                  {selectedAcceptanceClient && (
                    <div className="mt-2 rounded-xl border accent-border dark:accent-border accent-soft dark:accent-soft p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">
                            {clientName(selectedAcceptanceClient)}
                          </p>

                          <p className="text-sm text-gray-500">
                            {selectedAcceptanceClient.documento ||
                              'Sin documento'}
                          </p>
                        </div>

                        {selectedClient &&
                          selectedAcceptanceClient.id ===
                            selectedClient.id && (
                            <span className="text-xs font-semibold accent-text dark:accent-text">
                              Cliente de la solicitud
                            </span>
                          )}
                      </div>
                    </div>
                  )}

                  {!selectedAcceptanceClient &&
                    form.client_acceptance && (
                      <div className="mt-2 space-y-2">
                        {loadingAcceptanceClients && (
                          <p className="text-sm text-gray-500">
                            Buscando...
                          </p>
                        )}

                        {acceptanceClients.map(
                          (client) => (
                            <button
                              key={
                                client.id ||
                                client.id_externo
                              }
                              type="button"
                              onClick={() =>
                                chooseAcceptanceClient(
                                  client
                                )
                              }
                              className="w-full rounded-xl border border-gray-200 dark:border-gray-800 p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800"
                            >
                              <span className="font-semibold block">
                                {clientName(client)}
                              </span>

                              <span className="text-xs text-gray-500">
                                {client.documento ||
                                  'Sin documento'}
                                {' · '}
                                {client.telefono ||
                                  'Sin teléfono'}
                              </span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                </div>

                <label>
                  <span className="text-sm font-semibold">
                    Documento *
                  </span>

                  <input
                    value={
                      form.client_acceptance_document
                    }
                    readOnly
                    placeholder="Se completa al seleccionar el cliente"
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 px-3 cursor-not-allowed"
                  />
                </label>
                <label>
                  <span className="text-sm font-semibold">Canal *</span>
                  <select
                    value={form.client_acceptance_channel}
                    onChange={(event) =>
                      update('client_acceptance_channel', event.target.value)
                    }
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  >
                    <option value="whatsapp">WhatsApp</option>
                    <option value="email">Correo</option>
                    <option value="phone">Llamada</option>
                    <option value="in_person">Presencial</option>
                    <option value="other">Otro</option>
                  </select>
                </label>
                <label>
                  <span className="text-sm font-semibold">
                    Referencia / evidencia
                  </span>
                  <textarea
                    rows={3}
                    value={form.client_acceptance_reference}
                    onChange={(event) =>
                      update('client_acceptance_reference', event.target.value)
                    }
                    placeholder="Ej: aceptación presencial / WhatsApp 10:42"
                    className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                  />
                </label>
              </div>
              <IntakeAcceptance client={selectedClient} ensureDraft={ensureDraft} revision={acceptanceRevision} signedRevision={signedRevision} onSigned={(rev,act)=>{setSignedRevision(rev);setAcceptanceAct(act);}} act={acceptanceAct} signature={acceptanceSignature} onSignature={setAcceptanceSignature} isEdit={isEdit} scope={form.scope_text} conditions={[form.conditions_text,form.additional_costs_notice].filter(Boolean).join('\n\n')} />
              {(!isEdit || editDetail?.intake?.id) && <AcceptanceEvidenceFiles intakeId={isEdit ? editDetail?.intake?.id : createdIntakeRef.current?.id} pending={acceptanceFiles} onChange={setAcceptanceFiles} disabled={saving} />}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-5">
              {/* SECCIÓN: Opciones de programación */}
              <div className="rounded-xl border accent-border dark:accent-border accent-soft dark:accent-soft p-4">
                <h4 className="font-semibold accent-text dark:accent-text mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Opciones de programación
                </h4>
                <p className="text-sm accent-text dark:accent-text mb-3">
                  Elige cómo quieres que se programe esta orden de servicio
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      schedulingMode === 'auto'
                        ? 'accent-border accent-soft dark:accent-soft'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scheduling_mode"
                      value="auto"
                      checked={schedulingMode === 'auto'}
                      onChange={() => setSchedulingMode('auto')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">Programación automática</p>
                      <p className="text-xs text-gray-500">
                        El sistema buscará el primer espacio común disponible
                        para todos los técnicos seleccionados
                      </p>
                    </div>
                  </label>
                  <label
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      schedulingMode === 'manual'
                        ? 'accent-border accent-soft dark:accent-soft'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scheduling_mode"
                      value="manual"
                      checked={schedulingMode === 'manual'}
                      onChange={() => setSchedulingMode('manual')}
                      className="mt-1"
                    />
                    <div>
                      <p className="font-medium">Programación manual</p>
                      <p className="text-xs text-gray-500">
                        Tú eliges fecha y hora; el sistema valida que todo el equipo esté libre durante la duración completa
                      </p>
                    </div>
                  </label>
                </div>

                {schedulingMode === 'auto' && (
                  <div className="mt-3 p-3 accent-soft dark:accent-soft rounded-lg border accent-border dark:accent-border">
                    <p className="text-xs accent-text dark:accent-text flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                      El sistema buscará desde el próximo bloque de 15 minutos el primer intervalo libre para todo el equipo. Se respetan los horarios laborales configurados y los bloques ocupados en Agenda, durante toda la duración del servicio.
                    </p>
                  </div>
                )}

                {schedulingMode === 'manual' && (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-semibold">Fecha programada *</label>
                        <input
                          type="date"
                          value={form.scheduled_date}
                          onChange={(event) => update('scheduled_date', event.target.value)}
                          min={bogotaDateInput()}
                          className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-semibold">Hora de inicio *</label>
                        <input
                          type="time"
                          value={form.scheduled_time}
                          onChange={(event) => update('scheduled_time', event.target.value)}
                          className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-yellow-700 dark:text-yellow-300 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      Se validará que la fecha no esté en el pasado y que todos los técnicos seleccionados estén libres durante toda la duración del servicio.
                    </p>
                  </div>
                )}
              </div>

              {/* Resto del contenido del paso 4: Técnicos */}
              {!isAdmin ? (
                <div className="rounded-2xl border accent-border dark:accent-border accent-soft dark:accent-soft p-4">
                  <div className="flex items-start gap-3">
                    <UserCheck className="w-5 h-5 mt-0.5 accent-text shrink-0" />
                    <div>
                      <p className="font-bold">
                        Quedarás propuesto como técnico responsable
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Administración revisará la solicitud antes de
                        convertirla en OS y enviártela formalmente.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-sm font-semibold">
                      Buscar técnico
                    </label>
                    <div className="relative mt-1">
                      <Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                      <input
                        value={technicianSearch}
                        onChange={(event) =>
                          setTechnicianSearch(event.target.value)
                        }
                        placeholder="Nombre, usuario, cédula, celular o correo"
                        className="w-full min-h-12 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 pl-10 pr-3"
                      />
                    </div>
                  </div>

                  {selectedPrimary && (
                    <div className="rounded-2xl border accent-border dark:accent-border accent-soft dark:accent-soft p-4">
                      <p className="text-xs uppercase tracking-wide font-semibold accent-text dark:accent-text">
                        Responsable principal
                      </p>
                      <p className="font-bold mt-1">
                        {[selectedPrimary.nombre1, selectedPrimary.apellidos]
                          .filter(Boolean)
                          .join(' ')}
                      </p>
                      <p className="text-sm text-gray-500">
                        @{selectedPrimary.usuario || 'sin-usuario'}
                      </p>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const ids = filteredTechnicians.map((tech) => tech.id);
                        if (ids.length === 0) return;
                        const nextPrimary =
                          primaryTechnicianId && ids.includes(primaryTechnicianId)
                            ? primaryTechnicianId
                            : ids[0];

                        setPrimaryTechnicianId(nextPrimary);
                        setSupportTechnicianIds(
                          ids.filter((id) => id !== nextPrimary)
                        );
                      }}
                      className="min-h-10 rounded-xl border accent-border accent-text dark:accent-text px-3 text-sm font-semibold"
                    >
                      Marcar visibles
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPrimaryTechnicianId('');
                        setSupportTechnicianIds([]);
                      }}
                      className="min-h-10 rounded-xl border border-gray-300 dark:border-gray-700 px-3 text-sm font-semibold"
                    >
                      Desmarcar todos
                    </button>
                  </div>

                  <div
                    className="max-h-[44dvh] sm:max-h-80 overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 dark:border-gray-800 p-2 space-y-2"
                    style={{ WebkitOverflowScrolling: 'touch' }}
                  >
                    {filteredTechnicians.map((tech) => {
                      const isPrimary = primaryTechnicianId === tech.id;
                      const isSupport = supportTechnicianIds.includes(tech.id);
                      const isChecked = isPrimary || isSupport;

                      return (
                        <label
                          key={tech.id}
                          className={`rounded-xl border p-3 flex items-start gap-3 cursor-pointer ${
                            isPrimary
                              ? 'accent-border accent-soft dark:accent-soft'
                              : isSupport
                                ? 'accent-border accent-soft dark:accent-soft'
                                : 'border-gray-200 dark:border-gray-800'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(event) => {
                              const checked = event.target.checked;

                              if (checked) {
                                if (!primaryTechnicianId) {
                                  setPrimaryTechnicianId(tech.id);
                                  return;
                                }

                                if (primaryTechnicianId !== tech.id) {
                                  setSupportTechnicianIds((current) =>
                                    current.includes(tech.id)
                                      ? current
                                      : [...current, tech.id]
                                  );
                                }

                                return;
                              }

                              if (isPrimary) {
                                const remaining = supportTechnicianIds.filter(
                                  (id) => id !== tech.id
                                );

                                const nextPrimary = remaining[0] || '';

                                setPrimaryTechnicianId(nextPrimary);
                                setSupportTechnicianIds(
                                  nextPrimary
                                    ? remaining.filter((id) => id !== nextPrimary)
                                    : []
                                );
                              } else {
                                setSupportTechnicianIds((current) =>
                                  current.filter((id) => id !== tech.id)
                                );
                              }
                            }}
                            className="mt-1 w-5 h-5 shrink-0"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="font-semibold truncate">
                              {[tech.nombre1, tech.nombre2, tech.apellidos]
                                .filter(Boolean)
                                .join(' ') || tech.usuario}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              @{tech.usuario || 'sin-usuario'} ·{' '}
                              {tech.celular || tech.email || 'sin contacto'}
                            </p>

                            {isChecked && (
                              <label className="mt-2 inline-flex items-center gap-2 text-xs font-semibold accent-text dark:accent-text">
                                <input
                                  type="radio"
                                  name="primary-technician"
                                  checked={isPrimary}
                                  onChange={() => {
                                    const oldPrimary = primaryTechnicianId;

                                    setPrimaryTechnicianId(tech.id);

                                    setSupportTechnicianIds((current) => {
                                      const next = current.filter(
                                        (id) => id !== tech.id
                                      );

                                      if (
                                        oldPrimary &&
                                        oldPrimary !== tech.id &&
                                        !next.includes(oldPrimary)
                                      ) {
                                        next.push(oldPrimary);
                                      }

                                      return next;
                                    });
                                  }}
                                />
                                Responsable principal
                              </label>
                            )}
                          </div>

                          <span
                            className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold ${
                              isPrimary
                                ? 'accent-fill text-white'
                                : isSupport
                                  ? 'accent-fill text-white'
                                  : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                            }`}
                          >
                            {isPrimary
                              ? 'Principal'
                              : isSupport
                                ? 'Apoyo'
                                : 'No asignado'}
                          </span>
                        </label>
                      );
                    })}

                    {filteredTechnicians.length === 0 && (
                      <p className="p-6 text-center text-sm text-gray-500">
                        No hay técnicos que coincidan con la búsqueda.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl bg-gray-50 dark:bg-gray-950/40 p-4 text-sm">
                    <p>
                      <strong>Principal:</strong>{' '}
                      {selectedPrimary
                        ? [selectedPrimary.nombre1, selectedPrimary.apellidos]
                            .filter(Boolean)
                            .join(' ')
                        : 'Pendiente'}
                    </p>
                    <p className="mt-1">
                      <strong>Técnicos de apoyo:</strong>{' '}
                      {supportTechnicianIds.length}
                    </p>
                    <p className="mt-1 text-gray-500">
                      La agenda se bloqueará automáticamente para todos los
                      seleccionados cuando la OS sea aprobada.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="space-y-5">
              {selectedClient&&<IntakeInvoicePicker edit={isEdit} initialReference={form.invoice_reference} selectedInvoice={invoiceLinked} key={selectedClient.id} client={selectedClient} ensureDraft={ensureDraft} onLinked={record=>{setInvoiceChanged(true);setInvoiceLinked(record);setInvoiceFile(null);update('invoice_reference',record.reference);}} file={invoiceFile} onFile={setInvoiceFile} admin={isAdmin}/>}

              <details className="rounded-xl border p-3"><summary className="cursor-pointer font-semibold">Control de pago</summary><div className="mt-3 space-y-3">
              {isAdmin && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => update('billing_mode', 'prepaid')}
                    className={`rounded-2xl border p-4 text-left ${
                      form.billing_mode === 'prepaid'
                        ? 'accent-border accent-soft dark:accent-soft'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <p className="font-bold">Prepago</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Factura y pago deben verificarse antes de crear la OS.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => update('billing_mode', 'postpaid')}
                    className={`rounded-2xl border p-4 text-left ${
                      form.billing_mode === 'postpaid'
                        ? 'accent-border accent-soft dark:accent-soft'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <p className="font-bold">Pospago excepcional</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Debe quedar justificación administrativa.
                    </p>
                  </button>
                </div>
              )}

              {!isAdmin && (
                <div className="rounded-xl border accent-border dark:accent-border accent-soft dark:accent-soft p-4 text-sm accent-text dark:accent-text">
                  Tu solicitud quedará pendiente de validación administrativa,
                  pago y activación como OS.
                </div>
              )}

              {form.billing_mode === 'prepaid' && (
                <>
                  {isAdmin && (
                    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3">
                      <label className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={paymentVerified}
                          disabled={
                            isEdit &&
                            initialEditSnapshot.current?.paymentStatus === 'verified'
                          }
                          onChange={(event) =>
                            setPaymentVerified(event.target.checked)
                          }
                          className="w-5 h-5"
                        />
                        <span className="font-semibold">
                          Caja / administración verificó el pago
                        </span>
                      </label>

                      {paymentVerified && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <label>
                            <span className="text-sm font-semibold">
                              Método
                            </span>
                            <select
                              value={paymentMethod}
                              onChange={(event) =>
                                setPaymentMethod(event.target.value)
                              }
                              className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                            >
                              <option value="cash">Efectivo</option>
                              <option value="card">Datáfono</option>
                              <option value="transfer">Transferencia</option>
                              <option value="credit">Crédito</option>
                              <option value="other">Otro</option>
                            </select>
                          </label>
                          <label>
                            <span className="text-sm font-semibold">
                              Referencia / soporte *
                            </span>
                            <input
                              value={paymentReference}
                              onChange={(event) =>
                                setPaymentReference(event.target.value)
                              }
                              className="mt-1 w-full min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3"
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {form.billing_mode === 'postpaid' && (
                <label className="block">
                  <span className="text-sm font-semibold">
                    Justificación de pospago *
                  </span>
                  <textarea
                    rows={4}
                    value={form.postpaid_reason}
                    onChange={(event) =>
                      update('postpaid_reason', event.target.value)
                    }
                    className="mt-1 w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2"
                  />
                </label>
              )}

              </div></details>
              <div className="rounded-2xl bg-gray-50 dark:bg-gray-950/40 p-4">
                <p className="font-bold">Resumen</p>
                {form.equipment_intake?.equipments?.length>0&&<ul className="my-3 text-sm">{form.equipment_intake.equipments.map((item,index)=><li key={item.id}>Equipo {index+1}: {[item.equipment_type,item.brand,item.model].filter(Boolean).join(' · ')} · Serial: {item.serial_number||item.serial_reason}</li>)}</ul>}
                <ServiceInventoryRequirements value={selectedType?.inventory_requirements||[]} />
                {invoiceLinked?.record?<div className="mt-3"><InvoiceRecord record={invoiceLinked.record} reference={invoiceLinked.reference}/></div>:<p className="mt-3 text-sm">{form.invoice_reference?`Referencia guardada: ${form.invoice_reference}. Busca y selecciona la factura para cargar sus datos.`:'No se ha seleccionado una factura.'}</p>}
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500">Cliente</p>
                    <p className="font-semibold">
                      {clientName(selectedClient)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tipo</p>
                    <p className="font-semibold">
                      {form.service_type_name || 'Sin definir'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Clasificación</p>
                    <p className="font-semibold">
                      {form.classification === 'diagnostic'
                        ? 'Revisión / diagnóstico'
                        : 'Servicio específico'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Modalidad</p>
                    <p className="font-semibold">
                      {form.billing_mode === 'prepaid' ? 'Prepago' : 'Pospago'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Programación</p>
                    <p className="font-semibold">
                      {schedulingMode === 'auto' ? 'Automática' : 'Manual'}
                    </p>
                  </div>
                  {schedulingMode === 'manual' && form.scheduled_date && (
                    <div>
                      <p className="text-gray-500">Fecha / hora manual</p>
                      <p className="font-semibold">
                        {form.scheduled_date}
                        {form.scheduled_time ? ` ${form.scheduled_time}` : ''}
                      </p>
                    </div>
                  )}
                  {schedulingMode === 'auto' && (
                    <div>
                      <p className="text-gray-500">Agenda automática</p>
                      <p className="font-semibold">Próximo espacio común libre</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-gray-200 dark:border-gray-800 p-3 sm:p-4 bg-white dark:bg-gray-900">
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                if (step === 0) onClose();
                else setStep((value) => value - 1);
              }}
              className="min-h-11 rounded-xl border border-gray-300 dark:border-gray-700 px-4 font-semibold flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              {step === 0 ? 'Cancelar' : 'Anterior'}
            </button>

            {step < steps.length - 1 ? (
              <button
                type="button"
                onClick={goNext}
                className="min-h-11 rounded-xl accent-fill hover:accent-fill text-white px-5 font-semibold flex items-center justify-center gap-2"
              >
                Siguiente
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={saving || loadingExisting}
                onClick={submit}
                className="min-h-12 rounded-xl accent-fill hover:accent-fill disabled:opacity-50 text-white px-5 font-semibold flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                {saving
                  ? 'Guardando...'
                  : isEdit
                    ? 'Guardar cambios'
                    : isAdmin
                      ? 'Guardar y crear OS'
                      : 'Enviar solicitud'}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}