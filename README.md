# Annual Report PDF to Word (Client-Side AI)

An AI-powered web application that converts complex Annual Report PDFs into structured Markdown and native Microsoft Word (.docx) documents, running **entirely in your browser**.

<img width="918" height="476" alt="Screenshot 2026-11-11 225932" src="https://github.com/user-attachments/assets/19e9cdc9-83f2-4bd4-91cf-7069d997efc8" />

## Overview

Annual reports are notoriously difficult to process automatically due to multi-column layouts, nested financial tables, and complex hierarchies. Traditional PDF extractors often produce broken text blobs.

This project leverages the **Google Gemini API** (Gemini 3.1 Flash Lite, 3.8 Flash, and Pro) to deeply understand document semantics. It reconstructs layouts, stitches broken tables across pages, and generates clean, editable Markdown and DOCX files.

**Privacy First:** Unlike traditional SaaS tools, this app processes everything client-side. Your sensitive financial PDFs are sent directly from your browser to Google's API, with no intermediary backend server storing your data.

---

## Features

✅ **100% Client-Side Processing:** No backend required. Highly secure and cost-effective.

✅ **Smart Chunking:** Bypasses API context limits by intelligently splitting PDFs and merging results.

✅ **Rate-Limit Handling:** Built-in queue, auto-retry, and exponential backoff for stable API calls.

✅ **Advanced Table Reconstruction:** Accurately converts complex PDF tables into Markdown/Word tables.

✅ **Native Word Export:** Generates real `.docx` files (Times New Roman, Justified, 10pt) using `docx.js`.

✅ **Interactive Review Workspace:** Compare original PDF pages side-by-side with generated Markdown before exporting.

---

## How It Works (The Pipeline)

```text
            Annual Report PDF (Browser)
                    │
                    ▼
        ┌────────────────────────────┐
        │ pdf-lib: Chunking          │ (Splits PDF into manageable batches)
        └────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────┐
        │ Rate Limiter & Task Queue  │ (Manages concurrent API calls)
        └────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────┐
        │ Google Gemini API          │ (Extracts layouts, tables, headings)
        └────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────┐
        │ Markdown Merger & AST      │ (Stitches tables & validates output)
        └────────────────────────────┘
                    │
                    ▼
        ┌────────────────────────────┐
        │ docx.js: Native Export     │ (Builds Word document programmatically)
        └────────────────────────────┘
                    │
                    ▼
             Word Document (.docx)
```

---

## Tech Stack

- **Frontend Framework:** React + TypeScript (Vite)
- **Styling:** Tailwind CSS + Lucide React (Icons)
- **AI Integration:** Official `@google/genai` SDK
- **PDF Manipulation:** `pdf-lib` (Splitting) & `pdfjs-dist` (Rendering)
- **Markdown Parsing:** `marked` (AST Lexer)
- **Word Generation:** `docx` (docx.js) & `file-saver`

---

## Installation & Local Development

Since this is a pure frontend application, setup is incredibly simple.

### 1. Clone the Repository
```bash
git clone https://github.com/TruongPhatHuy/annual-report-pdf-to-word.git
cd annual-report-pdf-to-word
```

### 2. Install Dependencies
```bash
npm install
# or
yarn install
```

### 3. Run the Development Server
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## Usage

1. **Enter API Key:** Provide your Google AI Studio API Key in the settings modal (stored only in browser memory).
2. **Upload PDF:** Drag and drop an Annual Report PDF (supports 100-300+ pages).
3. **Configure Pipeline:** Adjust concurrency, chunk size, and select your preferred Gemini model (e.g., Flash Lite or Pro).
4. **Extract:** Watch the real-time progress bar. The system will handle rate limits automatically.
5. **Review & Edit:** Use the side-by-side editor to fix any Markdown issues.
6. **Export:** Download the `.docx`, `.md`, or the JSON Validation Report.

---

## Challenges Conquered

### 1. The Token Limit Wall
Large reports (300+ pages) crash standard API calls. 
*Solution:* A custom chunking algorithm that splits PDFs into 8-page batches, runs them concurrently, and merges the Markdown outputs seamlessly.

### 2. Table Pagination
Tables broken across two PDF pages usually become two separate entities.
*Solution:* The Markdown merger detects tables ending at the bottom of a chunk and automatically stitches them with tables starting at the top of the next chunk.

### 3. Strict API Rate Limits (429 Errors)
Free tier APIs have strict RPM (Requests Per Minute) limits.
*Solution:* A custom `GlobalRateLimiter` class pauses the queue, calculates wait times, and retries failed chunks using exponential backoff without crashing the app.

---

## Roadmap

- [ ] Add support for detecting and extracting Charts/Graphs into data tables.
- [ ] Multi-language translation during extraction.
- [ ] Connect directly to vector databases (FAISS/Pinecone) for instant RAG readiness.
- [ ] Build a lightweight Python FastAPI backend for enterprise batch processing.

---

## Contributing

Contributions are welcome! If you want to improve table extraction or add new export formats:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m "Add amazing feature"`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License. See the LICENSE file for details.

---

## Author

**Trương Phát Huy**  
GitHub: [https://github.com/TruongPhatHuy](https://github.com/TruongPhatHuy)  

If you find this project useful for your Data Engineering or RAG workflows, consider giving it a ⭐!
