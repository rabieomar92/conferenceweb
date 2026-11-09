// Cache-busting: ?v=<file modified time>, so a browser never keeps running an old script or stylesheet after a deploy.
const fs = require('fs'), path = require('path');
const memo = {};
module.exports = (name) => memo[name] || (memo[name] = (() => { try { return Math.floor(fs.statSync(path.join(__dirname, '..', 'public', 'assets', name)).mtimeMs / 1000).toString(36); } catch (_) { return '0'; } })());
