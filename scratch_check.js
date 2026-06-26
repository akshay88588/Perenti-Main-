import dotenv from 'dotenv';
dotenv.config();

let privateKey = process.env.FIREBASE_PRIVATE_KEY;
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '');
}

console.log("Any backslashes left?", privateKey.includes('\\'));
const matches = privateKey.match(/\\./g);
if (matches) {
  console.log("Escaped sequences found:", matches);
}
// Validate base64 length and format
const base64Body = privateKey
  .replace('-----BEGIN PRIVATE KEY-----', '')
  .replace('-----END PRIVATE KEY-----', '')
  .replace(/\s/g, '');
console.log("Base64 body length:", base64Body.length);
console.log("Is valid base64 character set?", /^[a-zA-Z0-9+/=]+$/.test(base64Body));
if (!/^[a-zA-Z0-9+/=]+$/.test(base64Body)) {
  const invalidChars = base64Body.match(/[^a-zA-Z0-9+/=]/g);
  console.log("Invalid characters:", [...new Set(invalidChars)]);
}
