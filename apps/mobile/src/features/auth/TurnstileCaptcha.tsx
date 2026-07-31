import { useRef } from "react";
import { View } from "react-native";
import { WebView } from "react-native-webview";

const SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;

/** Whether captcha is configured at all. When false the whole widget is skipped and
 * sign-up proceeds without a token — so an unconfigured project keeps working instead
 * of hard-failing on a missing key. Enable it by setting EXPO_PUBLIC_TURNSTILE_SITE_KEY
 * *and* turning on captcha protection in Supabase (Auth -> Settings -> Bot protection);
 * both sides must agree or Supabase will reject the token. */
export const isCaptchaConfigured = Boolean(SITE_KEY);

/** Rendered height. Turnstile's managed widget is ~65px; give it a little slack. */
const WIDGET_HEIGHT = 74;

function buildHtml(siteKey: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no" />
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
    <style>
      html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
      #cf { display: flex; justify-content: center; }
    </style>
  </head>
  <body>
    <div
      id="cf"
      class="cf-turnstile"
      data-sitekey="${siteKey}"
      data-callback="onSuccess"
      data-error-callback="onError"
      data-expired-callback="onExpired"
    ></div>
    <script>
      function post(payload) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
      function onSuccess(token) { post({ type: 'token', token: token }); }
      function onError() { post({ type: 'error' }); }
      function onExpired() { post({ type: 'expired' }); }
    </script>
  </body>
</html>`;
}

interface TurnstileCaptchaProps {
  /** Fires with a fresh token on solve, and with null when it errors or expires so the
   * caller can invalidate a token it was still holding. */
  onToken: (token: string | null) => void;
}

export function TurnstileCaptcha({ onToken }: TurnstileCaptchaProps) {
  const webViewRef = useRef<WebView>(null);

  if (!SITE_KEY) return null;

  return (
    <View style={{ height: WIDGET_HEIGHT }}>
      <WebView
        ref={webViewRef}
        source={{ html: buildHtml(SITE_KEY), baseUrl: "https://duoqueue.app" }}
        originWhitelist={["https://*"]}
        style={{ backgroundColor: "transparent" }}
        scrollEnabled={false}
        // Turnstile needs JS and DOM storage; everything else stays locked down.
        javaScriptEnabled
        domStorageEnabled
        onMessage={(event) => {
          try {
            const payload = JSON.parse(event.nativeEvent.data) as { type: string; token?: string };
            if (payload.type === "token" && payload.token) onToken(payload.token);
            else onToken(null);
          } catch {
            onToken(null);
          }
        }}
      />
    </View>
  );
}
