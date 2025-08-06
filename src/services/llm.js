
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const getCompletion = async (prompt) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo-0125',
    messages: [{ role: 'system', content: 'You are a scheduling agent. Be concise and directive. Goal: complete booking/reschedule/cancel with minimal words. No chit-chat. Offer at most top 2–3 options. Avoid long explanations.' }, { role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 120,
    presence_penalty: 0,
    frequency_penalty: 0,
  });
  return response.choices[0].message.content;
};

module.exports = {
  getCompletion,
};
