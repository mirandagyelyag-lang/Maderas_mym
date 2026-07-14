import jsPDF from 'jspdf';
import { LOGO_URL, fmtMoney, fmtDate } from './format';

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function generateCotizacionPDF(cotizacion, detalles) {
  const doc = new jsPDF();
  const pageW = doc.internal.pageSize.getWidth();

  const logo = await loadImage(LOGO_URL);
  if (logo) {
    try { doc.addImage(logo, 'PNG', 14, 10, 28, 28); } catch (e) { /* skip */ }
  }

  doc.setFontSize(20);
  doc.setTextColor(193, 162, 119);
  doc.setFont('helvetica', 'bold');
  doc.text('MADERAS M&M', 48, 20);

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'normal');
  doc.text('Cotizacion N° ' + String(cotizacion.numero || 0).padStart(4, '0'), 48, 27);
  doc.text('Fecha: ' + fmtDate(cotizacion.fecha || new Date()), 48, 33);

  doc.setDrawColor(193, 162, 119);
  doc.setLineWidth(0.8);
  doc.line(14, 40, pageW - 14, 40);

  let y = 50;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text(cotizacion.nombre_cliente || '-', 38, y);
  y += 7;

  if (cotizacion.telefono_cliente) {
    doc.setFont('helvetica', 'bold');
    doc.text('Telefono:', 14, y);
    doc.setFont('helvetica', 'normal');
    doc.text(cotizacion.telefono_cliente, 38, y);
    y += 7;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('Validez:', 14, y);
  doc.setFont('helvetica', 'normal');
  doc.text((cotizacion.validez_dias || 15) + ' dias', 38, y);
  y += 10;

  doc.setFillColor(245, 240, 232);
  doc.rect(14, y - 5, pageW - 28, 8, 'F');
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Descripcion', 16, y);
  doc.text('Cant.', 120, y);
  doc.text('P. Unit.', 140, y);
  doc.text('Subtotal', 170, y);
  y += 8;

  doc.setFont('helvetica', 'normal');
  (detalles || []).forEach((d) => {
    if (y > 255) { doc.addPage(); y = 20; }
    doc.text(String(d.descripcion || '').substring(0, 50), 16, y);
    doc.text(String(d.cantidad || 0), 122, y);
    doc.text(fmtMoney(d.precio_unitario), 138, y);
    doc.text(fmtMoney(d.subtotal), 168, y);
    y += 7;
  });

  y += 4;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(120, y, pageW - 14, y);
  y += 8;

  doc.setFontSize(10);
  doc.text('Subtotal:', 140, y);
  doc.text(fmtMoney(cotizacion.subtotal || 0), 168, y);
  y += 7;

  if (cotizacion.descuento > 0) {
    doc.text('Descuento:', 140, y);
    doc.text('- ' + fmtMoney(cotizacion.descuento), 168, y);
    y += 7;
  }

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(193, 162, 119);
  doc.text('TOTAL:', 140, y);
  doc.text(fmtMoney(cotizacion.total || 0), 168, y);

  if (cotizacion.observaciones) {
    y += 12;
    doc.setFontSize(9);
    doc.setTextColor(80, 80, 80);
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones:', 14, y);
    doc.setFont('helvetica', 'normal');
    const split = doc.splitTextToSize(cotizacion.observaciones, pageW - 28);
    doc.text(split, 14, y + 5);
  }

  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text('Maderas M&M - Cotizacion valida por ' + (cotizacion.validez_dias || 15) + ' dias.', 14, 287);

  return doc;
}