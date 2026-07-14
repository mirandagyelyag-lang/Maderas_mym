export const LOGO_URL = "https://media.base44.com/images/public/6a519e16e97fa11a377e2c82/31c08827e_LOGO3.png";

export const fmtMoney = (n) => '$' + Math.round(n || 0).toLocaleString('es-CL');

export const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const fmtDateTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const fmtPhone = (phone) => (phone || '').replace(/[^\d+]/g, '');

export const waLink = (phone, text) => {
  const p = fmtPhone(phone).replace(/^\+/, '');
  return `https://wa.me/${p}${text ? '?text=' + encodeURIComponent(text) : ''}`;
};