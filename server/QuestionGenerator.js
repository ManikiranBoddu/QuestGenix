require('dotenv').config();
const axios = require('axios');

async function generateQuestions(text, questionTypes, jobDescription = '') {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not provided');

  const url = 'https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent';

  const minQuestions = Math.min(20, Math.max(5, Math.floor(text.length / 200)));

  console.log(
    'Generating questions with text length:',
    text.length,
    'text sample:',
    text.substring(0, 200),
    '... and types:',
    questionTypes,
    'minQuestions:',
    minQuestions
  );

  const validQuestionTypes = ['mcq', 'fill_in_the_blanks', 'descriptive', 'msq'];
  const filteredQuestionTypes = questionTypes
    .map((type) => type.toLowerCase())
    .filter((type) => validQuestionTypes.includes(type));

  if (filteredQuestionTypes.length === 0) {
    throw new Error('No valid question types specified');
  }

  const excludedTypes = validQuestionTypes.filter((type) => !filteredQuestionTypes.includes(type));

  const prompt = `
    Text: "${text.replace(/"/g, '\\"')}"
    ${jobDescription ? `Job Description: "${jobDescription.replace(/"/g, '\\"')}"` : ''}
    Generate EXACTLY ${minQuestions} questions of the following types: ${filteredQuestionTypes.join(', ')}.
    Do NOT generate ANY questions of type ${excludedTypes.join(', ')} or any other types.
    - MCQs: Provide exactly 4 options, 1 correct answer, formatted as JSON with "type": "mcq", "question": "...", "options": ["..."], "answer": "...".
    - Fill-in-the-blanks: Provide a sentence with a single blank ("____") and formatted as JSON with "type": "fill_in_the_blanks", "question": "...", "answer": "...".
    - Descriptive: Provide open-ended questions as JSON with "type": "descriptive", "question": "...", "answer": "..." (provide a sample answer for evaluation).
    - MSQs: Provide exactly 4 options, 2 or more correct answers, formatted as JSON with "type": "msq", "question": "...", "options": ["..."], "answer": ["...", "..."] (array of correct answers).
    Ensure the questions are diverse and cover different aspects of the text${jobDescription ? ' and job description' : ''}, distributed proportionally across the selected types.
    Return ONLY valid JSON: [{"type": "mcq", "question": "...", "options": ["..."], "answer": "..."}, ...]
    If any question generated does not match the specified types or number, discard it and regenerate to ensure strict adherence.
  `;

  const maxRetries = 3;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      console.log('Sending prompt to Gemini (attempt', attempt + 1, 'of', maxRetries, ')(length:', prompt.length, '):', prompt.substring(0, 200) + '...');
      const response = await axios.post(
        `${url}?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000, // 30-second timeout
        }
      );
      console.log('Gemini API response:', response.data);
      const rawContent = response.data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawContent || typeof rawContent !== 'string') {
        throw new Error('Invalid response from Gemini API: No text content');
      }

      const cleanedContent = rawContent.replace(/```json\n|\n```/g, '').trim();
      if (!cleanedContent.startsWith('[') || !cleanedContent.endsWith(']')) {
        console.error('Unexpected response format:', cleanedContent);
        throw new Error('Gemini API returned non-JSON or malformed response');
      }

      const questions = JSON.parse(cleanedContent);
      console.log('Parsed questions:', questions);

      const filteredQuestions = questions.filter((q) => filteredQuestionTypes.includes(q.type.toLowerCase()));

      if (filteredQuestions.length === 0) {
        throw new Error('No valid questions generated for the specified types');
      }

      if (filteredQuestions.length < minQuestions) {
        console.warn('Fewer questions generated than requested, retrying...');
        continue; // Retry with the same attempt
      }

      const questionsPerType = Math.floor(minQuestions / filteredQuestionTypes.length) || 1;
      let finalQuestions = [];
      for (const type of filteredQuestionTypes) {
        const typeQuestions = filteredQuestions.filter((q) => q.type.toLowerCase() === type).slice(0, questionsPerType);
        finalQuestions = finalQuestions.concat(typeQuestions);
      }

      while (finalQuestions.length < minQuestions && filteredQuestions.length > finalQuestions.length) {
        const remaining = filteredQuestions.filter((q) => !finalQuestions.includes(q));
        finalQuestions.push(remaining[0]);
      }

      return finalQuestions.slice(0, minQuestions);
    } catch (error) {
      attempt++;
      console.error('Gemini API attempt', attempt, 'failed:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data || 'No response data',
      });
      if (attempt === maxRetries) {
        console.warn('Max retries reached, returning empty questions array');
        return []; // Fallback to empty array
      }
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt)); // Exponential backoff
    }
  }

  throw new Error('Unexpected exit from generateQuestions loop'); // Should never reach here
}

module.exports = { generateQuestions };