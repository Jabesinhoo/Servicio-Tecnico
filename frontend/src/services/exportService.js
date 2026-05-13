// src/services/exportService.js
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Exportar a Excel
export const exportToExcel = (data, filename, sheetName = 'Reporte') => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}.xlsx`);
};

// Exportar a PDF
export const exportToPDF = (data, title, columns, filename) => {
  const doc = new jsPDF({ orientation: 'landscape' });
  
  // Título
  doc.setFontSize(16);
  doc.text(title, 14, 15);
  doc.setFontSize(10);
  doc.text(`Generado: ${new Date().toLocaleString()}`, 14, 25);
  
  // Tabla
  autoTable(doc, {
    head: [columns],
    body: data.map(row => columns.map(col => row[col.key] || '')),
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [41, 128, 185], textColor: 255 },
    alternateRowStyles: { fillColor: [240, 240, 240] },
  });
  
  doc.save(`${filename}.pdf`);
};

// Formatear moneda
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(value || 0);
};

// Formatear fecha
export const formatDate = (date) => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-CO');
};