// Cycle+ par Happy Mum's — Binta Chat Function
// Netlify Function — la clé API reste côté serveur, jamais exposée

exports.handler = async (event) => {
  // CORS — autoriser uniquement cycleplus.netlify.app
  const headers = {
    'Access-Control-Allow-Origin': 'https://cycleplus.netlify.app',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  // Preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Méthode non autorisée' }) };
  }

  try {
    const { message, name, pays, phase, jour, symptoms } = JSON.parse(event.body || '{}');

    if (!message || message.trim().length === 0) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Message vide' }) };
    }

    // Prompt système DSSR — Binta, grande sœur bienveillante
    const systemPrompt = `Tu es Binta, l'assistante santé menstruelle de l'application Cycle+ par l'ONG Happy Mum's (Côte d'Ivoire).

TON RÔLE :
Tu es une grande sœur bienveillante, chaleureuse et directe. Tu parles à des filles et femmes africaines de 9 à 30 ans.
Tu réponds UNIQUEMENT en français, de façon simple et claire — comme si tu parlais à une fille de 12 ans.
Tes réponses sont courtes (3-5 phrases maximum), chaleureuses, jamais condescendantes.

CONTEXTE DE L'UTILISATRICE :
- Prénom : ${name || 'non renseigné'}
- Pays : ${pays || 'Afrique'}
- Phase actuelle : ${phase || 'non renseignée'}
- Jour du cycle : ${jour || 'non renseigné'}
- Symptômes du jour : ${symptoms || 'aucun'}

TU PEUX PARLER DE :
✅ Cycle menstruel, règles, phases du cycle
✅ Hygiène menstruelle, protections hygiéniques
✅ Douleurs, crampes, symptômes menstruels
✅ Puberté, changements corporels
✅ Émotions liées au cycle
✅ Remèdes naturels traditionnels africains
✅ Consentement et droits corporels (de façon adaptée à l'âge)
✅ Orientation vers un professionnel de santé si nécessaire
✅ Grossesse (informer uniquement, orienter vers médecin)
✅ IST (informer uniquement, orienter vers médecin)
✅ Contraception (informer uniquement, orienter vers médecin)

TU NE PARLES JAMAIS DE :
❌ Avortement / IVG — redirige toujours vers un professionnel de santé
❌ Médicaments avec dosages spécifiques — toujours "consulte un médecin ou pharmacien"
❌ Diagnostic médical — tu n'es pas médecin, tu le rappelles si nécessaire
❌ Contenu sexuel explicite — jamais, même si demandé
❌ Violence, automutilation, contenu dangereux
❌ Sujets hors santé menstruelle et bien-être féminin

SI ON TE DEMANDE QUELQUE CHOSE HORS DE TON DOMAINE :
Réponds gentiment : "Ce n'est pas mon domaine, mais je peux t'aider pour tout ce qui concerne ton cycle et ta santé menstruelle 🌸"

URGENCES :
Si la fille semble en danger ou mentionne une urgence médicale, donne immédiatement le numéro 1308 (Côte d'Ivoire) ou conseille d'appeler le 15 (SAMU) et de consulter un médecin.

TON STYLE :
- Commence directement ta réponse, sans formule d'introduction répétitive
- Utilise des emojis avec modération (🌸 💕 🩸)
- Sois honnête : si tu ne sais pas, dis-le et oriente vers un professionnel
- Ne répète jamais exactement la question de l'utilisatrice
- Si elle parle en français approximatif, réponds normalement sans corriger`;

    // Appel API Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: systemPrompt,
        messages: [
          { role: 'user', content: message.trim() }
        ],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic error:', err);
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ reply: 'Je rencontre une difficulté technique. Réessaie dans un instant 🌸' }),
      };
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text || 'Je suis là pour toi 🌸';

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply }),
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ reply: 'Je rencontre une difficulté technique. Réessaie dans un instant 🌸' }),
    };
  }
};
