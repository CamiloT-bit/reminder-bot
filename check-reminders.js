const fetch = require('node-fetch');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function main() {
  console.log('SUPABASE_URL definida:', !!SUPABASE_URL);
  console.log('Revisando recordatorios...');
  const now = new Date().toISOString();

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/reminders?enviado=eq.false&fecha_hora_utc=lte.${now}&select=*`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const reminders = await res.json();
  console.log(`Encontrados: ${reminders.length}`);

  for (const r of reminders) {
    console.log(`Enviando: "${r.mensaje}"`);
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${r.phone}&text=${encodeURIComponent(r.mensaje)}&apikey=${r.apikey}`;
      await fetch(url);
      await fetch(`${SUPABASE_URL}/rest/v1/reminders?id=eq.${r.id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ enviado: true })
      });
      console.log(`Enviado OK: "${r.mensaje}"`);
    } catch (e) {
      console.error(`Error: ${e.message}`);
    }
  }
}

main().catch(console.error);
