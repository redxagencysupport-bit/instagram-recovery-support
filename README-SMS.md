# REDX Auth, SMS OTP, and Live Setup

REDX can run in free auth mode without SMS. The browser never stores SMS provider secrets.

## Free Auth Mode

Use this on Render when you do not want to pay for SMS:

```env
REDX_REQUIRE_SMS_OTP=false
REDX_DEV_OTP=false
REDX_OTP_SECRET=replace-this-with-a-long-random-string
```

With this mode, users can create accounts and log in with:

```text
username/email + password
```

Optional Google sign-in can be enabled with:

```env
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
```

## Optional Real SMS OTP

Only use this if you want SMS security codes and have a paid-capable SMS setup.

1. Create a Twilio Verify Service.
2. Fill these values in `.env` or Render Environment Variables:

```env
REDX_REQUIRE_SMS_OTP=true
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_VERIFY_SERVICE_SID=VA...
REDX_DEV_OTP=false
```

3. Start REDX:

```powershell
cd C:\Users\rofik\Documents\Codex\2026-07-29\hi\outputs\redx
npm start
```

5. Open:

```text
http://localhost:3000
```

## Local Test Mode

If you specifically want to test the SMS-code screen without Twilio, set `REDX_REQUIRE_SMS_OTP=true` and `REDX_DEV_OTP=true` in `.env`.
The server will print the OTP in the terminal and the browser may show it as a local dev code.

## Database

REDX stores shared app data in a local SQLite file:

```text
outputs/redx/redx.sqlite
```

Accounts, posts, reels, stories, messages, notifications, follows, and live-session status are saved there. Keep `.env` and `redx.sqlite*` private.

## REDX Live

REDX includes a WebRTC signaling server at:

```text
ws://localhost:3000/ws/live
```

When HTTPS is configured, the same endpoint becomes:

```text
wss://your-domain.com/ws/live
```

When you go live, followers who open REDX on the same running backend can tap your LIVE story and watch the real camera stream. This is peer-to-peer WebRTC, which is good for local testing and a small number of viewers.

### Public Internet Setup

1. Put REDX on a server with a real domain.
2. Get HTTPS certificates from your host or Let's Encrypt.
3. Add the certificate paths to `.env`:

```env
REDX_HTTPS_KEY=C:\path\to\privkey.pem
REDX_HTTPS_CERT=C:\path\to\fullchain.pem
```

4. Add TURN details to `.env`:

```env
REDX_STUN_URLS=stun:stun.l.google.com:19302
REDX_TURN_URLS=turn:turn.your-domain.com:3478,turns:turn.your-domain.com:5349
REDX_TURN_USERNAME=your-turn-username
REDX_TURN_CREDENTIAL=your-turn-password
```

5. Restart REDX:

```powershell
node server.js
```

REDX exposes the browser WebRTC config at:

```text
/api/rtc-config
```

For many live viewers like Instagram, use an SFU media server such as LiveKit or mediasoup instead of pure peer-to-peer. Pure WebRTC peer-to-peer makes the broadcaster send one video copy per viewer, so it is not the right design for hundreds or thousands of viewers.
