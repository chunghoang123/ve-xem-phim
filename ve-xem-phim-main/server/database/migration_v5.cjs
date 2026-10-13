const pool = require('../config/database.cjs');

function decodeEmbeddedJson(value) {
  if (!value) return '';
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return value;
  }
}

function parseTlv(value) {
  const fields = {};
  let offset = 0;
  while (offset + 4 <= value.length) {
    const tag = value.slice(offset, offset + 2);
    const length = Number.parseInt(value.slice(offset + 2, offset + 4), 10);
    if (!Number.isFinite(length) || offset + 4 + length > value.length) break;
    fields[tag] = value.slice(offset + 4, offset + 4 + length);
    offset += 4 + length;
  }
  return fields;
}

function extractVietQrRecipient(qrCode) {
  const root = parseTlv(qrCode || '');
  const merchantAccount = parseTlv(root['38'] || '');
  const beneficiary = parseTlv(merchantAccount['01'] || '');
  return { accountNumber: beneficiary['01'] || '', bankBin: beneficiary['00'] || '' };
}

async function migrateV5() {
  const conn = await pool.getConnection();
  try {
    console.log('Running migration v5 (persist PayOS recipient details)...');
    const columns = [
      ['account_name', 'VARCHAR(255) NULL'],
      ['account_number', 'VARCHAR(100) NULL'],
      ['bank_bin', 'VARCHAR(20) NULL'],
    ];

    for (const [name, definition] of columns) {
      const [existing] = await conn.query('SHOW COLUMNS FROM payments LIKE ?', [name]);
      if (existing.length === 0) {
        await conn.query(`ALTER TABLE payments ADD COLUMN ${name} ${definition}`);
        console.log(`  payments.${name} added`);
      }
    }

    const [legacyPayments] = await conn.query(
      `SELECT id, checkout_url, qr_code FROM payments
       WHERE checkout_url IS NOT NULL AND checkout_url <> ''
         AND (account_name IS NULL OR account_name = ''
              OR account_number IS NULL OR account_number = ''
              OR bank_bin IS NULL OR bank_bin = '')`
    );
    for (const payment of legacyPayments) {
      try {
        const qrRecipient = extractVietQrRecipient(payment.qr_code);
        const url = new URL(payment.checkout_url);
        if (url.protocol !== 'https:' || url.hostname !== 'pay.payos.vn') continue;
        const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) continue;
        const html = await response.text();
        const normalizedHtml = html.replace(/\\"/g, '"');
        const accountName = decodeEmbeddedJson(normalizedHtml.match(/"accountName":"([^"]*)"/)?.[1]);
        const accountNumber = decodeEmbeddedJson(normalizedHtml.match(/"accountNo":"([^"]*)"/)?.[1]) || qrRecipient.accountNumber;
        if (accountName || accountNumber || qrRecipient.bankBin) {
          await conn.query(
            `UPDATE payments
             SET account_name = COALESCE(NULLIF(account_name, ''), ?),
                 account_number = COALESCE(NULLIF(account_number, ''), ?),
                 bank_bin = COALESCE(NULLIF(bank_bin, ''), ?)
             WHERE id = ?`,
            [accountName, accountNumber, qrRecipient.bankBin, payment.id]
          );
        }
      } catch {
        // Old links may be expired or unavailable; new links persist these fields directly.
      }
    }
    console.log('Migration v5 completed successfully!');
  } finally {
    conn.release();
    await pool.end();
  }
}

migrateV5().catch((err) => {
  console.error('Migration v5 failed:', err);
  process.exit(1);
});
