import { envConfig } from 'src/configs/env.config';
import { SUPPORTED_LANGUAGES } from 'src/configs/language';

export async function translate(text: string, from?: string, to?: string) {
  if (!text || !from || !to || from === 'auto' || to === 'auto') return '';
  // if not in supported languages, return text
  const isFromSupported = SUPPORTED_LANGUAGES.some(
    (lang) => lang.code === from,
  );
  const isToSupported = SUPPORTED_LANGUAGES.some((lang) => lang.code === to);
  if (!isFromSupported || !isToSupported) return text;

  if (from === to) return text;

  try {
    const body = {
      content: text,
      from,
      to,
    };
    const response = await fetch(
      `${envConfig.app.url}/api/languages/v3/translate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      },
    );
    const json = await response.json();
    return json.data;
  } catch (error) {
    return '';
  }
}

export const multipleTranslate = async ({
  content,
  sourceLang,
  targetLangs,
}: {
  content: string;
  sourceLang: string;
  targetLangs: string[];
}) => {
  targetLangs = [...new Set(targetLangs)];
  const index = targetLangs.indexOf(sourceLang);
  if (index > -1) {
    targetLangs.splice(index, 1);
  }
  const translations = await Promise.all(
    targetLangs.map((lang) => translate(content, sourceLang, lang)),
  );
  return targetLangs.reduce(
    (acc, lang, i) => {
      acc[lang] = translations[i];
      return acc;
    },
    { [sourceLang]: content },
  );
};

export const detectLanguage = async (content: string) => {
  const response = await fetch(`${envConfig.app.url}/api/languages/v3/detect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content }),
  });
  try {
    const json = await response.json();
    return json.data.language;
  } catch (error) {
    console.log('error', error);
    return 'en';
  }
};
