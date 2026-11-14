// Chạy: npm start → mở http://localhost:3000/?username=ten_tiktok
// Chỉ phục vụ trang game (thư mục public/). Sự kiện TikTok do backend riêng đảm nhận: dự án TiktokLive, cổng 3100.
// Biến môi trường: PORT=3000 (tuỳ chọn), BACKEND_URL (npm start sinh public/config.js).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC = new URL('./public/', import.meta.url);
export const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.json': 'application/json; charset=utf-8' };
export const FILES = /^\/(index\.html|queue\.js|comment-limit\.js|levels\.js|scenes\.js|config\.js|backend-url\.js|live-events\.js|speech\.js|sound\.js|sound-cues\.js)$|^\/assets\/[\w-]+\.webp$|^\/sounds\/[\w-]+\.(mp3|json)$/;

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname !== '/' && !FILES.test(pathname)) return res.writeHead(404).end();
  const file = pathname === '/' ? 'index.html' : pathname.slice(1);
  try {
    const data = await readFile(new URL(file, PUBLIC));
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)], 'Cache-Control': 'no-cache' });
    res.end(data);
  } catch { res.writeHead(404).end(); }
});
// Chỉ mở cổng khi chạy trực tiếp (npm start); test import chỉ cần FILES và TYPES.
if (process.argv[1] === fileURLToPath(import.meta.url)) server.listen(PORT, '127.0.0.1', () => console.log(`Game: http://localhost:${PORT}/?username=ten_tiktok`));
