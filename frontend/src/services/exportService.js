// src/services/exportService.js
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ============================================================
// CONFIGURACIÓN DE LA EMPRESA - TECNONACHO S.A.S
// ============================================================
const EMPRESA = {
  nombre: 'TECNONACHO S.A.S',
  nit: '901.067.698-7',
  direccion: 'Cl. 84 #47-30 Loc 4 y 5, Nte. Centro Historico, Barranquilla, Atlántico',
  telefonos: ['304 658 8769', '300 825 0012', '302 270 9500', '301 785 4258', '304 594 8995'],
  telefono_principal: '304 658 8769',
  email: 'atencion.serviciotecnico84@gmail.com',
  logo_url: 'https://i.imgur.com/W6Ns7w6.png',
  resolucion: 'RES-XXX-2026',
  prefijo: 'FAC',
  moneda: 'COP',
};

// ============================================================
// COLORES CORPORATIVOS - VERDES
// ============================================================
const COLORS = {
  primary: [27, 94, 32],      // Verde oscuro #1B5E20
  secondary: [46, 125, 50],   // Verde medio #2E7D32
  accent: [255, 111, 0],      // Naranja #FF6F00 (para totales)
  text: [40, 40, 40],
  textLight: [100, 100, 100],
  white: [255, 255, 255],
  bgLight: [232, 245, 233],   // Verde muy claro
  border: [165, 190, 170],    // Verde grisáceo
};

// ============================================================
// FUNCIÓN PRINCIPAL - EXPORTAR A PDF (Diseño Profesional)
// ============================================================
export const exportToPDF = async (data, title, columns, filename, facturaData = null) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = 20;

  const cliente = facturaData?.cliente || {};
  const servicio = facturaData?.servicio || {};

  // ============================================================
  // 1. HEADER - LOGO + DATOS EMPRESA
  // ============================================================
  try {
    const img = new Image();
    img.src = EMPRESA.logo_url;
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve;
    });
    doc.addImage(img, 'PNG', margin, 10, 38, 38);
  } catch (e) {
    // Si no carga el logo, no pasa nada
  }

  // Nombre empresa (grande, negrita)
  doc.setFontSize(20);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFont('helvetica', 'bold');
  doc.text(EMPRESA.nombre, 58, 22);

  // NIT
  doc.setFontSize(10);
  doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`NIT: ${EMPRESA.nit}`, 58, 30);

  // Teléfonos y email (a la derecha)
  doc.setFontSize(7);
  doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
  doc.text(`Tel: ${EMPRESA.telefonos[0]}`, pageWidth - margin - 50, 14);
  doc.text(`Email: ${EMPRESA.email}`, pageWidth - margin - 50, 20);

  // ============================================================
  // 2. LÍNEA SEPARADORA
  // ============================================================
  y = 52;
  doc.setDrawColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setLineWidth(1);
  doc.line(margin, y, pageWidth - margin, y);
  y += 5;

  // ============================================================
  // 3. TÍTULO Y NÚMERO DE FACTURA
  // ============================================================
  doc.setFontSize(16);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', margin, y + 4);

  doc.setFontSize(11);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFont('helvetica', 'normal');
  doc.text(`N° ${facturaData?.numero_factura || title}`, pageWidth - margin, y + 4, { align: 'right' });

  y += 10;

  // ============================================================
  // 4. DATOS PRINCIPALES (FECHA, CLIENTE, MONEDA, TÉCNICO)
  // ============================================================
  const fechaEmision = facturaData?.fecha_emision ? new Date(facturaData.fecha_emision) : new Date();

  // Dibujar recuadro
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - 1, pageWidth - (margin * 2), 13);
  doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2]);
  doc.rect(margin, y - 1, pageWidth - (margin * 2), 13, 'F');

  doc.setFontSize(8);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFont('helvetica', 'normal');

  const col1 = margin + 5;
  const col2 = margin + 50;
  const col3 = margin + 95;
  const col4 = margin + 145;

  doc.text('FECHA', col1, y + 4);
  doc.text(fechaEmision.toLocaleDateString('es-CO'), col1, y + 9);

  doc.text('CLIENTE', col2, y + 4);
  doc.text(cliente.nombre || '—', col2, y + 9);

  doc.text('MONEDA', col3, y + 4);
  doc.text(EMPRESA.moneda, col3, y + 9);

  doc.text('TÉCNICO', col4, y + 4);
  doc.text(servicio.tecnico || 'Técnico Externo', col4, y + 9);

  y += 17;

  // ============================================================
  // 5. INFORMACIÓN DEL CLIENTE (Recuadro)
  // ============================================================
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - 1, pageWidth - (margin * 2), 18);
  doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2]);
  doc.rect(margin, y - 1, pageWidth - (margin * 2), 18, 'F');

  doc.setFontSize(8);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DEL CLIENTE', margin + 4, y + 3);

  doc.setFontSize(7);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFont('helvetica', 'normal');

  const row1 = y + 8;
  const row2 = y + 13;

  doc.text(`Documento: ${cliente.documento || '—'}`, margin + 4, row1);
  doc.text(`Teléfono: ${cliente.telefono || '—'}`, margin + 65, row1);
  doc.text(`Email: ${cliente.email || '—'}`, margin + 125, row1);

  doc.text(`Dirección: ${cliente.direccion || '—'}`, margin + 4, row2);
  doc.text(`Ciudad: ${cliente.ciudad || '—'}`, margin + 65, row2);

  y += 22;

  // ============================================================
  // 6. INFORMACIÓN DEL SERVICIO (Recuadro)
  // ============================================================
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - 1, pageWidth - (margin * 2), 18);
  doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2]);
  doc.rect(margin, y - 1, pageWidth - (margin * 2), 18, 'F');

  doc.setFontSize(8);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORMACIÓN DEL SERVICIO', margin + 4, y + 3);

  doc.setFontSize(7);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFont('helvetica', 'normal');

  const sRow1 = y + 8;
  const sRow2 = y + 13;

  doc.text(`OS: ${servicio.codigo_os || '—'}`, margin + 4, sRow1);
  doc.text(`Fecha: ${servicio.fecha_servicio || '—'}`, margin + 55, sRow1);
  doc.text(`Duración: ${servicio.duracion || '—'}`, margin + 110, sRow1);

  doc.text(`Descripción: ${servicio.descripcion || '—'}`, margin + 4, sRow2);

  y += 22;

  // ============================================================
  // 7. TABLA DE ITEMS (CON BORDES COMPLETOS)
  // ============================================================
  const items = facturaData?.items || [];

  let tableBody = [];

  if (items.length === 0) {
    tableBody = [
      [
        { content: '1', styles: { halign: 'center' } },
        { content: `${servicio.descripcion || 'Servicio técnico'}\nSKU: --`, styles: { fontSize: 6 } },
        { content: `$${Number(facturaData?.total_base || 0).toLocaleString()}`, styles: { halign: 'right' } },
        { content: '1', styles: { halign: 'center' } },
        { content: `$${Number(facturaData?.total_base || 0).toLocaleString()}`, styles: { halign: 'right' } },
      ]
    ];
  } else {
    items.forEach((item, index) => {
      const sku = item.SKU || item.sku || '--';
      const desc = item.descripcion || '—';
      const cantidad = item.cantidad || 1;
      const precio = Number(item.precio_unitario || 0);
      const subtotal = Number(item.subtotal || 0);

      tableBody.push([
        { content: String(index + 1), styles: { halign: 'center' } },
        { content: `${desc}\nSKU: ${sku}`, styles: { fontSize: 6 } },
        { content: `$${precio.toLocaleString()}`, styles: { halign: 'right' } },
        { content: String(cantidad), styles: { halign: 'center' } },
        { content: `$${subtotal.toLocaleString()}`, styles: { halign: 'right' } },
      ]);
    });
  }

  autoTable(doc, {
    startY: y,
    head: [[
      { content: '#', styles: { halign: 'center', fontStyle: 'bold' } },
      { content: 'DESCRIPCIÓN', styles: { fontStyle: 'bold' } },
      { content: 'VR. UNIT', styles: { halign: 'right', fontStyle: 'bold' } },
      { content: 'CANT.', styles: { halign: 'center', fontStyle: 'bold' } },
      { content: 'SUBTOTAL', styles: { halign: 'right', fontStyle: 'bold' } },
    ]],
    body: tableBody,
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 2.5,
      textColor: [40, 40, 40],
      lineColor: [165, 190, 170],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      lineColor: COLORS.primary,
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 30, halign: 'right' },
      3: { cellWidth: 15, halign: 'center' },
      4: { cellWidth: 35, halign: 'right' },
    },
    didParseCell: function(data) {
      if (data.column.index === 1 && data.section === 'body') {
        data.cell.styles.fontSize = 6;
      }
    },
    margin: { left: margin, right: margin },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ============================================================
  // 8. TOTALES (Recuadro con borde y línea naranja)
  // ============================================================
  const totalBase = Number(facturaData?.total_base || 0);
  const totalIva = Number(facturaData?.total_iva || 0);
  const totalGeneral = Number(facturaData?.total_general || 0);

  const boxWidth = 70;
  const boxX = pageWidth - margin - boxWidth;

  // Recuadro
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.3);
  doc.rect(boxX, y - 1, boxWidth, 32);
  doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2]);
  doc.rect(boxX, y - 1, boxWidth, 32, 'F');

  // Línea superior naranja
  doc.setDrawColor(COLORS.accent[0], COLORS.accent[1], COLORS.accent[2]);
  doc.setLineWidth(1.5);
  doc.line(boxX, y - 1, boxX + boxWidth, y - 1);

  let ty = y + 4;
  doc.setFontSize(8);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFont('helvetica', 'normal');

  doc.text('Subtotal:', boxX + 5, ty);
  doc.text(`$${totalBase.toLocaleString()}`, boxX + boxWidth - 5, ty, { align: 'right' });
  ty += 6;

  doc.text('IVA (19%):', boxX + 5, ty);
  doc.text(`$${totalIva.toLocaleString()}`, boxX + boxWidth - 5, ty, { align: 'right' });
  ty += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.text('TOTAL:', boxX + 5, ty);
  doc.text(`$${totalGeneral.toLocaleString()}`, boxX + boxWidth - 5, ty, { align: 'right' });

  y += 36;

  // ============================================================
  // 9. TÉRMINOS Y CONDICIONES (Recuadro)
  // ============================================================
  doc.setDrawColor(COLORS.border[0], COLORS.border[1], COLORS.border[2]);
  doc.setLineWidth(0.3);
  doc.rect(margin, y - 1, pageWidth - (margin * 2), 26);
  doc.setFillColor(COLORS.bgLight[0], COLORS.bgLight[1], COLORS.bgLight[2]);
  doc.rect(margin, y - 1, pageWidth - (margin * 2), 26, 'F');

  doc.setFontSize(8);
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFont('helvetica', 'bold');
  doc.text('TÉRMINOS Y CONDICIONES', margin + 4, y + 3);

  doc.setFontSize(6.5);
  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFont('helvetica', 'normal');

  const terminos = [
    `Resolución DIAN: ${EMPRESA.resolucion}`,
    `Términos de pago: ${facturaData?.terminos_pago || 'Según condiciones acordadas con el cliente.'}`,
    `Garantía mano de obra: ${facturaData?.garantia_mano_obra || 'Según tipo de servicio realizado.'}`,
    `Garantía repuestos: ${facturaData?.garantia_repuestos || 'Según fabricante y tipo de repuesto.'}`,
    `Factura generada electrónicamente.`,
  ];

  let ty2 = y + 8;
  terminos.forEach((t) => {
    doc.text(`• ${t}`, margin + 5, ty2);
    ty2 += 4.5;
  });

  y += 30;

  // ============================================================
  // 10. FIRMA Y SELLO
  // ============================================================
  doc.setDrawColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + 45, y);
  y += 3;
  doc.setFontSize(6);
  doc.setTextColor(COLORS.textLight[0], COLORS.textLight[1], COLORS.textLight[2]);
  doc.text('Firma autorizada', margin, y);

  doc.line(pageWidth - margin - 45, y - 3, pageWidth - margin, y - 3);
  doc.text('Sello de la empresa', pageWidth - margin - 45, y);

  y += 8;

  // ============================================================
  // 11. FOOTER
  // ============================================================
  const footerY = pageHeight - 8;
  doc.setFontSize(5.5);
  doc.setTextColor(180, 180, 180);
  doc.text(`© ${new Date().getFullYear()} ${EMPRESA.nombre} - ${EMPRESA.direccion}`, pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Tel: ${EMPRESA.telefonos.join(' / ')} - Email: ${EMPRESA.email}`, pageWidth / 2, footerY + 3, { align: 'center' });
  doc.text(`Factura generada electrónicamente - ${new Date().toLocaleString('es-CO')}`, pageWidth / 2, footerY + 6, { align: 'center' });

  // ============================================================
  // 12. GUARDAR PDF
  // ============================================================
  doc.save(`${filename}.pdf`);
};

// ============================================================
// EXPORTAR A EXCEL
// ============================================================
export const exportToExcel = (data, filename, sheetName = 'Reporte') => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
};

// ============================================================
// UTILIDADES
// ============================================================
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
};

export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-CO', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
};