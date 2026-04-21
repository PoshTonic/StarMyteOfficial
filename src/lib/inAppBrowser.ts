export type InAppPlatform = "ios" | "android" | "other";

export interface InAppBrowserInfo {
  isInApp: boolean;
  appName: string | null;
  platform: InAppPlatform;
}

const APP_SIGNATURES: Array<{ test: RegExp; name: string }> = [
  { test: /Instagram/i, name: "Instagram" },
  { test: /FBAN|FBAV|FB_IAB|FBIOS/i, name: "Facebook" },
  { test: /FB_Messenger|Messenger/i, name: "Messenger" },
  { test: /Threads/i, name: "Threads" },
  { test: /TikTok|musical_ly|Bytedance/i, name: "TikTok" },
  { test: /\bLine\//i, name: "LINE" },
  { test: /Snapchat/i, name: "Snapchat" },
  { test: /LinkedInApp/i, name: "LinkedIn" },
  { test: /Twitter|TwitterAndroid/i, name: "X (Twitter)" },
  { test: /Pinterest/i, name: "Pinterest" },
  { test: /KAKAOTALK/i, name: "KakaoTalk" },
];

export function detectInAppBrowser(): InAppBrowserInfo {
  if (typeof navigator === "undefined") {
    return { isInApp: false, appName: null, platform: "other" };
  }

  const ua = navigator.userAgent || "";

  let platform: InAppPlatform = "other";
  if (/iPhone|iPad|iPod/i.test(ua)) platform = "ios";
  else if (/Android/i.test(ua)) platform = "android";

  for (const { test, name } of APP_SIGNATURES) {
    if (test.test(ua)) {
      return { isInApp: true, appName: name, platform };
    }
  }

  return { isInApp: false, appName: null, platform };
}
