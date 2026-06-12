import { query } from './src/db.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function check() {
  const users = await query(`SELECT id, name, ai_api_key FROM users WHERE name LIKE '%López%' OR name LIKE '%Lopez%'`);
  const key = users[0].ai_api_key;
  if (!key) {
    console.log("NO API KEY");
    process.exit(1);
  }
  const genAI = new GoogleGenerativeAI(key);
  const modelsToTry = ['gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-flash-latest'];
  let lastError;
  let success = false;
  for (const m of modelsToTry) {
    try {
      console.log("Trying", m);
      const model = genAI.getGenerativeModel({ model: m });
      const res = await model.generateContent("Hola");
      console.log("Success with", m, ":", await res.response.text());
      success = true;
      break;
    } catch (err) {
      console.error(m, "ERROR:", err.message);
      lastError = err;
    }
  }
  if (!success) console.log("ALL FAILED", lastError.message);
  process.exit(0);
}

check();
