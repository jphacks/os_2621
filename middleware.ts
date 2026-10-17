import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 未ログインで P2 以降を開いたら P0（トップ）に戻す。セッションのCookieもここで更新する。
// API（/api/*）は対象外。各APIが自分で認証を確認する。
const PROTECTED_PREFIXES = ["/checkin", "/consult", "/summary", "/candidates", "/requests", "/rooms", "/settings"];

export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Supabase 未設定のローカル確認（画面だけ見たいとき）は何もしない
  if (!url || !anonKey) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isDemo = path === "/rooms/demo";
  const needsLogin = !isDemo && PROTECTED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));

  if (needsLogin && !data.user) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
