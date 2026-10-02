export async function onRequestPost(context) {
    const { user, pass } = await context.request.json();
    const env = context.env;
    
    // 简单校验环境变量中的账号密码
    if (user === env.ADMIN_USER && pass === env.ADMIN_PASS) {
        // 设置简单的会话 Cookie
        return new Response(JSON.stringify({ success: true, message: '登录成功' }), {
            headers: { 'Set-Cookie': `session=${env.SESSION_SECRET}; Path=/; HttpOnly` }
        });
    }
    return new Response(JSON.stringify({ success: false, message: '账号或密码错误' }), { status: 401 });
}