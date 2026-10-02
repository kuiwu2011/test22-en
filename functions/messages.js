


// functions/messages.js
async function hashPassword(password, salt) {
  const utf8 = new TextEncoder().encode(`${salt}:${password}`);
  const hashBuffer = await crypto.subtle.digest({name: 'SHA-256'}, utf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 自动建表
async function ensureTables(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL)").run();
  await db.prepare("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))").run();
}

// GET /messages - 获取留言和登录状态
export async function onRequestGet(context) {
  try {
    await ensureTables(context.env.DB);
    const cookie = context.request.headers.get('Cookie') || '';
    const isLoggedIn = cookie.includes(context.env.SESSION_SECRET);

    const { results } = await context.env.DB.prepare(
      "SELECT name, content FROM messages ORDER BY id DESC LIMIT 50"
    ).all();

    return new Response(JSON.stringify({ loggedIn: isLoggedIn, messages: results }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
}

// POST /messages - 处理注册、登录、留言
export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const SALT = env.SESSION_SECRET || "default_salt";

    const body = await request.json();
    const action = body.action; // 'register', 'login', 'message'

    // 注册
    if (action === 'register') {
      const { username, password } = body;
      if (!username || !password) return new Response('Missing fields', { status: 400 });

      const password_hash = await hashPassword(password, SALT);
      await ensureTables(env.DB);
      await env.DB.prepare("INSERT INTO users (username, password_hash) VALUES (?, ?)")
        .bind(username, password_hash).run();

      return new Response(JSON.stringify({ success: true, message: '注册成功' }), { status: 201 });
    }

    // 登录 - 修复：用 Headers 对象分别 append 两个 Cookie
    if (action === 'login') {
      const { username, password } = body;
      const password_hash = await hashPassword(password, SALT);

      await ensureTables(env.DB);
      const { results } = await env.DB.prepare("SELECT id FROM users WHERE username = ? AND password_hash = ?")
        .bind(username, password_hash).all();

      if (results.length > 0) {
        const headers = new Headers();
        headers.append('Set-Cookie', `session=${env.SESSION_SECRET}; Path=/; HttpOnly`);
        headers.append('Set-Cookie', `username=${encodeURIComponent(username)}; Path=/; Max-Age=86400`);
        headers.set('Content-Type', 'application/json');

        return new Response(JSON.stringify({ success: true }), { headers });
      } else {
        return new Response(JSON.stringify({ success: false, message: '账号或密码错误' }), { status: 401 });
      }
    }

    // 发表留言
    if (action === 'message') {
      const cookie = request.headers.get('Cookie') || '';
      if (!cookie.includes(env.SESSION_SECRET)) {
        return new Response('Unauthorized', { status: 401 });
      }

      // 从 Cookie 读取用户名
      let name = '';
      const cookies = cookie.split(';');
      for (let c of cookies) {
        const [key, value] = c.trim().split('=');
        if (key === 'username') { name = decodeURIComponent(value); break; }
      }

      const { content } = body;
      if (!content) return new Response('Missing content', { status: 400 });

      await ensureTables(env.DB);
      await env.DB.prepare("INSERT INTO messages (name, content) VALUES (?, ?)")
        .bind(name || '匿名', content).run();

      return new Response(JSON.stringify({ success: true }), { status: 201 });
    }

    return new Response('Invalid action', { status: 400 });
  } catch (err) {
    return new Response("Error: " + err.message, { status: 500 });
  }
}
