const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (path === '/api/docs' && request.method === 'GET') {
        const list = await env.TYPING_DOCS.list();
        const docs = [];
        for (const key of list.keys) {
          const value = await env.TYPING_DOCS.get(key.name);
          if (value) {
            const data = JSON.parse(value);
            docs.push({
              id: key.name,
              name: data.name,
              length: data.text.length,
              created: data.created
            });
          }
        }
        docs.sort((a, b) => new Date(b.created) - new Date(a.created));
        return new Response(JSON.stringify({ docs }), {
          headers: CORS_HEADERS
        });
      }

      if (path.match(/^\/api\/docs\/[^/]+$/) && request.method === 'GET') {
        const id = path.split('/').pop();
        const value = await env.TYPING_DOCS.get(id);
        if (!value) {
          return new Response(JSON.stringify({ error: '文档不存在' }), {
            status: 404,
            headers: CORS_HEADERS
          });
        }
        return new Response(value, {
          headers: CORS_HEADERS
        });
      }

      if (path === '/api/docs' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.text) {
          return new Response(JSON.stringify({ error: '缺少 name 或 text 字段' }), {
            status: 400,
            headers: CORS_HEADERS
          });
        }
        const id = generateId();
        const doc = {
          id,
          name: body.name,
          text: body.text,
          created: new Date().toISOString()
        };
        await env.TYPING_DOCS.put(id, JSON.stringify(doc));
        return new Response(JSON.stringify({
          success: true,
          id,
          doc: { id, name: doc.name, length: doc.text.length, created: doc.created }
        }), {
          headers: CORS_HEADERS
        });
      }

      if (path.match(/^\/api\/docs\/[^/]+$/) && request.method === 'DELETE') {
        const id = path.split('/').pop();
        await env.TYPING_DOCS.delete(id);
        return new Response(JSON.stringify({ success: true }), {
          headers: CORS_HEADERS
        });
      }

      return new Response(JSON.stringify({ error: 'Not Found' }), {
        status: 404,
        headers: CORS_HEADERS
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: CORS_HEADERS
      });
    }
  }
};
