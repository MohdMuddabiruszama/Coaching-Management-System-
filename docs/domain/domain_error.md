Your screenshots clearly show the exact problem.

### Error from Console

```text
Access to XMLHttpRequest at
https://coaching-management-system-24xn.onrender.com/api/plans

from origin

https://www.zenithflows.in

has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present
```

and

```text
500 Internal Server Error
```

---

# Root Cause

Your backend on Render is **not allowing**:

```text
https://www.zenithflows.in
```

but it is allowing:

```text
https://coaching-management-system-lemon.vercel.app
```

That's why:

✅ Vercel URL works

❌ Custom domain fails

---

# Fix #1 (Most Important)

Go to your backend code.

Find something like:

```javascript
app.use(cors({
  origin: process.env.APP_ORIGIN,
  credentials: true
}));
```

or

```javascript
const corsOptions = {
  origin: process.env.APP_ORIGIN
}
```

Replace with:

```javascript
const allowedOrigins = [
  "https://coaching-management-system-lemon.vercel.app",
  "https://zenithflows.in",
  "https://www.zenithflows.in"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("CORS Not Allowed"));
  },
  credentials: true
}));
```

---

# Fix #2

Check Render Environment Variables.

Open:

```text
Render
→ Service
→ Environment
```

Look for:

```env
APP_ORIGIN=
```

Currently it is probably:

```env
APP_ORIGIN=https://coaching-management-system-lemon.vercel.app
```

Change to:

```env
APP_ORIGIN=https://zenithflows.in
```

or

```env
APP_ORIGIN=https://www.zenithflows.in
```

If your code supports multiple origins:

```env
APP_ORIGIN=https://zenithflows.in,https://www.zenithflows.in,https://coaching-management-system-lemon.vercel.app
```

---

# Fix #3

Your frontend is opening:

```text
https://www.zenithflows.in
```

Notice the error shows:

```text
Origin:
https://www.zenithflows.in
```

But your domain list contains:

```text
zenithflows.in
www.zenithflows.in
```

These are two different origins.

You must allow BOTH.

```javascript
[
 "https://zenithflows.in",
 "https://www.zenithflows.in"
]
```

---

# Fix #4

The 500 error means the backend endpoint itself is crashing.

Open Render:

```text
Dashboard
→ Backend Service
→ Logs
```

Then visit:

```text
https://www.zenithflows.in
```

Look for errors from:

```text
/api/plans
/api/lifetime/info
```

You will likely see:

```text
CORS Error
```

or

```text
Origin Not Allowed
```

or

```text
APP_ORIGIN mismatch
```

---

# Quick Test

After updating CORS and redeploying backend:

Open browser console and run:

```javascript
fetch("https://coaching-management-system-24xn.onrender.com/api/plans")
```

If you get JSON back, it is fixed.

---

## Based on your screenshots

I am about **99% sure** the issue is in your backend CORS configuration because the browser explicitly reports:

```text
Origin https://www.zenithflows.in
has been blocked by CORS policy
```

So the first place to fix is:

```javascript
cors(...)
```

and

```env
APP_ORIGIN
```

in your Render backend service. If you send your current `cors` code (from `server.js`, `app.js`, or wherever you configure Express), I can tell you the exact lines to change.
