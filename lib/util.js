'use strict';
// Canonical form of an email address, used to stop the same mailbox registering twice
// (case, "+tag" suffixes, and Gmail dots are ignored).
function normaliseEmail(email) {
  const [local0 = '', domain0 = ''] = String(email).trim().toLowerCase().split('@');
  let domain = domain0, local = local0.split('+')[0];
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local + '@' + domain;
}
function maskEmail(email) {
  const [l, d] = String(email).split('@');
  return (l.length <= 2 ? l[0] + '*' : l[0] + '*'.repeat(Math.min(l.length - 2, 6)) + l.slice(-1)) + '@' + d;
}
module.exports = { normaliseEmail, maskEmail };
