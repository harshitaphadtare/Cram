# Setting up Google (and optional Microsoft) sign-in

**Status:** Google sign-in is live. Microsoft is supported in the code but not enabled — its
button stays hidden until the Azure provider is switched on in Supabase.

The login and sign-up pages show **Continue with Google** / **Continue with Microsoft** buttons
automatically once a provider is enabled in Supabase (the app checks every 5 minutes). Until then
the buttons stay hidden, so nothing looks broken. Provider keys live **only in Supabase** — no
`.env` or Vercel variables are needed.

You'll need your Supabase **callback URL**. Find it in Supabase → **Authentication → Providers →
Google** (or Azure). It looks like:

```
https://<your-project-ref>.supabase.co/auth/v1/callback
```

---

## Google (≈10 minutes)

### 1. Create the OAuth app
1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and create a project (e.g. "Cram").
2. **APIs & Services → OAuth consent screen**
   - User type: **External** → Create.
   - App name: `Cram`, user support email: yours, developer email: yours.
   - Scopes: leave the defaults (`email`, `profile`, `openid`). No extra scopes are needed.
   - Save. While the app is in *Testing*, only test users you add can sign in; click
     **Publish app** when you're ready for everyone (basic scopes don't need Google review).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**, name: `Cram web`.
   - **Authorised JavaScript origins**: `http://localhost:3000` and your production URL
     (`https://cram-eta.vercel.app`).
   - **Authorised redirect URIs**: your Supabase callback URL (from above).
   - Create, then copy the **Client ID** and **Client secret**.

### 2. Turn it on in Supabase
Supabase → **Authentication → Providers → Google** → enable, paste the Client ID and Client
secret → Save.

---

## Microsoft (optional, ≈10 minutes)

Lets students sign in with personal Microsoft accounts and most university Microsoft 365 accounts.

### 1. Register the app
1. Go to [portal.azure.com](https://portal.azure.com/) → **Microsoft Entra ID → App registrations → New registration**.
   - Name: `Cram`.
   - Supported account types: **Accounts in any organizational directory and personal Microsoft
     accounts**.
   - Redirect URI: platform **Web**, value = your Supabase callback URL.
   - Register.
2. Copy the **Application (client) ID** from the overview page.
3. **Certificates & secrets → New client secret** → copy the secret **Value** (not the ID). Note
   the expiry date and set a reminder to renew it.

### 2. Turn it on in Supabase
Supabase → **Authentication → Providers → Azure** → enable, paste the Client ID and secret.
Leave **Azure Tenant URL** empty (that allows any account type). Save.

> Some universities block third-party apps for student accounts. If a student sees "Need admin
> approval", their school's IT has to approve Cram, or they can use Google or email instead.

---

## Recommended Supabase settings

- **Authentication → Providers → Email**: keep enabled; set **password requirements** to minimum
  length 10 with lowercase, uppercase, digits and symbols (matches the app's rules).
- **Authentication → Sign In / Providers**: make sure *"Allow manual linking"* / automatic
  identity linking is on (the default), so someone who signed up with email and later uses Google
  with the **same email** gets the same account and keeps their streak.
- **Authentication → URL Configuration**: **Site URL** = your production URL; **Redirect URLs**
  include `http://localhost:3000/**` and `https://<your-domain>/**`.

## Checking it works
1. Wait up to 5 minutes (or restart `npm run dev`) and open `/login` — the buttons appear.
2. Click **Continue with Google**, pick an account → you land on the dashboard, and the product
   tour starts for a brand-new account.
3. Your name and Google profile photo appear in the sidebar.
