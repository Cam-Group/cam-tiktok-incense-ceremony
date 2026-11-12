import { writeFile } from 'node:fs/promises';
import normalizeBackendURL from './public/backend-url.js';

const eventsBase = normalizeBackendURL(process.env.BACKEND_URL || '');

// Chỉ xuất URL công khai, không đưa mật khẩu hay các biến môi trường khác vào frontend.
await writeFile(new URL('./public/config.js', import.meta.url),
  `// Tự sinh bởi npm run build từ BACKEND_URL.\nwindow.APP_CONFIG = ${JSON.stringify({ eventsBase })};\n`);
