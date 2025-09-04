// Quick IMAP test script
const Imap = require('node-imap');

// Test configuration for theaiwhisperer.de
const imapConfig = {
  host: 'mail.theaiwhisperer.de', // or whatever your custom IMAP server is
  port: 993,
  tls: true,
  user: 'hung@theaiwhisperer.de',
  password: 'your-password-here', // You'll need to fill this in
  tlsOptions: { rejectUnauthorized: false },
  authTimeout: 30000,
  connTimeout: 60000
};

console.log('Testing IMAP connection to:', imapConfig.host);

const imap = new Imap(imapConfig);

imap.once('ready', () => {
  console.log('✅ IMAP connection successful!');
  imap.end();
});

imap.once('error', (err) => {
  console.error('❌ IMAP connection failed:', err.message);
  console.error('Error details:', err);
});

imap.once('end', () => {
  console.log('📧 IMAP connection ended');
});

// Add timeout
setTimeout(() => {
  console.log('⏰ Connection timeout after 30 seconds');
  imap.destroy();
  process.exit(1);
}, 30000);

try {
  imap.connect();
} catch (error) {
  console.error('❌ Failed to initiate connection:', error.message);
  process.exit(1);
}