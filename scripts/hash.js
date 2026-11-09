const pw = process.argv[2];
if (!pw) { console.error('Usage: npm run hash -- "your-password"'); process.exit(1); }
console.log(require('bcryptjs').hashSync(pw, 12));
