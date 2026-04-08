const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const reminders = [];

app.get('/ping', (req, res) => res.json({ status: 'alive', time: new Date().toISOString() }));

app.post('/api/parse', async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Falta el texto' });

  const now = new Date();
  const manana = new Date(now.getTime() + 86400000).toISOString().split('T')[0];
  const hoy = now.toISOString().split('T')[0];

  const prompt = `Eres un asistente de recordatorios. El usuario escribe en lenguaje natural.
Fecha y hora actual: ${now.toLocaleString('es-CO', {timeZone:'America/Bogota'})}.
Zona horaria: Colombia (UTC-5).
El usuario dice: "${text}"

Responde SOLO con JSON válido sin markdown ni explicaciones:
Si es recordatorio:
{"entendido":true,"es_recordatorio":true,"mensaje_recordatorio":"texto a enviar por WhatsApp","fecha_hora_iso":"YYYY-MM-DDTHH:mm:ss","respuesta_chat":"confirmación amigable con hora exacta"}
Si NO es recordatorio:
{"entendido":false,"es_recordatorio":false,"respuesta_chat":"respuesta normal"}
"mañana"=${manana}, "hoy"=${hoy}`;

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', max_tokens: 500, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await response.json();
    const raw = (data.choices[0].message.content || '').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (e) {
    console.error('Error en /api/parse:', e.message);
    res.status(500).json({ error: 'Error al procesar con IA' });
  }
});

app.post('/api/reminder', (req, res) => {
  const { mensaje, fecha_hora_iso, phone, apikey } = req.body;
  if (!mensaje || !fecha_hora_iso || !phone || !apikey) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }
  const reminder = {
    id: Date.now(),
    mensaje,
    tiempo: new Date(fecha_hora_iso),
    phone,
    apikey,
    enviado: false,
    creado: new Date()
  };
  reminders.push(reminder);
  console.log(`Recordatorio creado: "${mensaje}" para ${reminder.tiempo.toISOString()}`);
  res.json({ ok: true, id: reminder.id, tiempo: reminder.tiempo });
});

app.get('/api/reminders', (req, res) => res.json(reminders));

app.delete('/api/reminder/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const idx = reminders.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  reminders.splice(idx, 1);
  res.json({ ok: true });
});

async function checkReminders() {
  const now = new Date();
  for (const r of reminders) {
    if (!r.enviado && r.tiempo <= now) {
      r.enviado = true;
      console.log(`Enviando recordatorio: "${r.mensaje}"`);
      try {
        const encoded = encodeURIComponent(r.mensaje);
        const url = `https://api.callmebot.com/whatsapp.php?phone=${r.phone}&text=${encoded}&apikey=${r.apikey}`;
        await fetch(url);
        console.log('Mensaje enviado exitosamente');
      } catch (e) {
        console.error('Error enviando WhatsApp:', e.message);
      }
    }
  }
}

setInterval(checkReminders, 30000);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
