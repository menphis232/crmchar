export async function callAIProvider(userConfig, systemPrompt, history, message) {
  let aiConfigs = [];
  try {
    if (userConfig.ai_api_key && userConfig.ai_api_key.trim().startsWith('[')) {
      aiConfigs = JSON.parse(userConfig.ai_api_key);
    } else if (userConfig.ai_api_key) {
      const keys = userConfig.ai_api_key.split(',').map(k => k.trim()).filter(Boolean);
      aiConfigs = keys.map(k => ({ provider: userConfig.ai_provider, key: k }));
    }
  } catch (e) {
    if (userConfig.ai_api_key) {
      aiConfigs = [{ provider: userConfig.ai_provider, key: userConfig.ai_api_key }];
    }
  }

  const validConfigs = aiConfigs.filter(c => c.provider && c.key);
  if (!validConfigs.length) {
    throw new Error('No hay configuraciones de IA válidas.');
  }

  let reply = '';
  let lastGlobalError = null;

  const geminiHistory = history.map(h => ({
    role: (h.role === 'assistant' || h.role === 'model') ? 'model' : 'user',
    parts: [{ text: h.content }]
  }));
  while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
    geminiHistory.shift();
  }

  const openAiMessages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: (h.role === 'assistant' || h.role === 'model') ? 'assistant' : 'user', content: h.content })),
    { role: 'user', content: message }
  ];

  keyLoop: for (const cfg of validConfigs) {
    const { provider, key } = cfg;

    if (provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const modelsToTry = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-pro-latest'];
      const genAI = new GoogleGenerativeAI(key);

      for (const modelName of modelsToTry) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: systemPrompt });
          const chat = model.startChat({ history: geminiHistory, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } });
          const result = await chat.sendMessage(message);
          reply = result.response.text();
          break keyLoop;
        } catch (err) {
          lastGlobalError = err;
          if (err.message && err.message.includes('404')) continue;
          break; // Fallback to next config
        }
      }
    } else if (provider === 'openai' || provider === 'deepseek') {
      const endpoint = provider === 'deepseek' ? 'https://api.deepseek.com/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      const modelName = provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini';

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
          body: JSON.stringify({ model: modelName, messages: openAiMessages, max_tokens: 1024, temperature: 0.7 })
        });

        if (!response.ok) {
          const errText = await response.text();
          lastGlobalError = new Error(errText);
          continue;
        }

        const data = await response.json();
        reply = data.choices?.[0]?.message?.content || '';
        break keyLoop;
      } catch (err) {
        lastGlobalError = err;
        continue;
      }
    }
  }

  if (!reply) {
    throw new Error('Error al conectar con los proveedores de IA. ' + (lastGlobalError?.message || ''));
  }

  return reply;
}
