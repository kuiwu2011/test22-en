export async function onRequest(context) {
  return new Response(null, {
    status: 302,
    headers: { 
      'Location': '/',
      'Set-Cookie': 'session=; Path=/; Max-Age=0; HttpOnly, username=; Path=/; Max-Age=0'
    }
  });
}