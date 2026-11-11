import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '60mb' }));
app.use(express.urlencoded({ extended: true, limit: '60mb' }));

// Health / status endpoints
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/gemini/status', (_req, res) => {
  const hasEnvKey = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  res.json({ hasEnvKey });
});

// Extraction endpoint
app.post('/api/gemini/extract', async (req, res) => {
  try {
    const { pdfBase64, startPage, endPage, model = 'gemini-3.8-flash', systemInstruction, customApiKey } = req.body;

    const apiKey = (customApiKey && String(customApiKey).trim()) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({
        error: 'Chưa có Gemini API Key. Vui lòng nhập API Key hoặc cấu hình trong môi trường hệ thống.',
        code: 'MISSING_API_KEY',
      });
    }

    if (!pdfBase64) {
      return res.status(400).json({ error: 'Thiếu dữ liệu PDF base64.', code: 'MISSING_PDF' });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const userPrompt = `Đây là các trang ${startPage}–${endPage} của tài liệu gốc. Dùng đúng số trang gốc này trong marker \`<!-- page: N -->\`. Trích xuất theo quy tắc.`;

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        },
        {
          text: userPrompt,
        },
      ],
      config: {
        systemInstruction,
        temperature: 0,
      },
    });

    const text = response.text || '';
    const finishReason = response.candidates?.[0]?.finishReason;
    const usageMetadata = response.usageMetadata;

    return res.json({
      text,
      finishReason,
      usageMetadata,
    });
  } catch (err: any) {
    console.error('Extraction error:', err);
    const status = err.status || err.statusCode || (String(err.message).includes('429') ? 429 : 500);
    const message = err.message || 'Lỗi không xác định khi gọi Gemini API';

    let retryDelay: number | undefined;
    if (err.errorDetails && Array.isArray(err.errorDetails)) {
      for (const d of err.errorDetails) {
        if (d.retryDelay) {
          const match = /^(\d+(\.\d+)?)s?$/.exec(String(d.retryDelay));
          if (match) retryDelay = Math.ceil(parseFloat(match[1]));
        }
      }
    }

    return res.status(status >= 400 && status < 600 ? status : 500).json({
      error: message,
      details: err.toString(),
      retryDelay,
      rawError: err.error || err,
    });
  }
});

// Mount Vite or serve static dist
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
} else {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

app.listen(port, '0.0.0.0', () => {
  console.log(`Annual Report Converter server listening on http://0.0.0.0:${port}`);
});
