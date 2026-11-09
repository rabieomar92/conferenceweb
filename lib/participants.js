'use strict';
// Participant profile: the extra registration details, their validation and a completeness checklist.
const SALUTATIONS = ['', 'Prof.', 'Assoc. Prof.', 'Dr.', 'Ir.', 'Ts.', 'Mr.', 'Ms.', 'Mrs.'];
const PARTICIPATION = ['Oral presentation', 'Poster presentation', 'Participant (non-presenting)'];
const DIETS = ['No special requirement', 'Vegetarian', 'Vegan', 'Other'];
const clean = (x, n) => String(x ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f<>]/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, n);
const line = (x, n) => clean(x, n).replace(/\s+/g, ' ');
const presenting = (r) => /presentation/i.test(r.participation || '');

// fields a participant may edit on their dashboard (name, organisation and country are validated in server.js like at registration)
function validate(b) {
  const errors = [], v = {
    salutation: SALUTATIONS.includes(b.salutation) ? b.salutation : '',
    designation: line(b.designation, 120),
    department: line(b.department, 160),
    participation: PARTICIPATION.includes(b.participation) ? b.participation : '',
    paper_title: line(b.paper_title, 300),
    paper_id: line(b.paper_id, 40),
    mass_no: line(b.mass_no, 40),
    diet: DIETS.includes(b.diet) ? b.diet : '',
    diet_note: line(b.diet_note, 160),
    dinner: b.dinner === 'yes' ? 'yes' : b.dinner === 'no' ? 'no' : '',
    billing: clean(b.billing, 500),
    phone: String(b.phone || '').trim().slice(0, 30),
  };
  if (v.phone && !/^[0-9+()\-\s]{6,30}$/.test(v.phone)) errors.push('Please enter a valid phone number.');
  if (!v.participation) errors.push('Please say how you are taking part (oral, poster or non-presenting).');
  if (v.diet !== 'Other') v.diet_note = '';
  return { v, errors };
}
function checklist(r) {
  return [
    ['Name, organisation and country', !!(r.full_name && r.organisation && r.country)],
    ['Position / designation', !!r.designation],
    ['How you are taking part', !!r.participation],
    ...(presenting(r) ? [['Paper title', !!r.paper_title]] : []),
    ...(/^MASS/i.test(r.category || '') ? [['MASS membership number', !!r.mass_no]] : []),
    ['Dietary requirement', !!r.diet],
    ['Conference dinner (yes / no)', !!r.dinner],
    ['Phone number', !!r.phone],
  ];
}
const completeness = (r) => { const c = checklist(r); return Math.round((100 * c.filter((x) => x[1]).length) / c.length); };
// a participant can download a certificate once the organisers have issued it, or once they are marked attended and the fee is settled
const certReady = (r, cfg) => !!(r.cert_issued_at || (cfg.certDownload && r.attended && (r.pay_status === 'paid' || r.pay_status === 'waived')));
const displayName = (r) => [r.salutation, r.full_name].filter(Boolean).join(' ');
module.exports = { SALUTATIONS, PARTICIPATION, DIETS, validate, checklist, completeness, certReady, presenting, displayName };
