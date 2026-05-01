# 🚀 TSEK Deployment Guide

Follow these steps to deploy your thesis project to production.

---

## 1. Setup Database (Neon.tech)
1. Go to [Neon.tech](https://neon.tech/) and create a free account.
2. Create a new project named **tsek-db**.
3. In the Neon dashboard, find your **Connection String**. It should look like:
   `postgresql://alex:password@ep-cool-darkness-123.us-east-2.aws.neon.tech/neondb?sslmode=require`
4. Copy this string; you will need it for Render.
5. Go to the **SQL Editor** in Neon and paste the contents of your `tsek_db_backup.sql` file to create your tables.

---

## 2. Deploy Backend (Render.com)
1. Go to [Render.com](https://render.com/) and create a free account.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub repository.
4. Set the following:
   - **Name:** `tsek-backend`
   - **Root Directory:** `tsek-backend`
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
5. Click **Advanced** and add these **Environment Variables**:
   - `DATABASE_URL`: (Paste your Neon connection string here)
   - `JWT_SECRET`: (Your secret key from .env)
   - `GEMINI_API_KEY`: (Your Gemini API key)
   - `SMTP_USER`: (Your email)
   - `SMTP_PASS`: (Your app password)
6. Click **Create Web Service**.
7. Once deployed, copy your Render URL (e.g., `https://tsek-backend.onrender.com`).

---

## 3. Configure Frontend
1. Open `tsek-frontend/src/environments/environment.prod.ts`.
2. Update `apiUrl` with your **Render URL** from the previous step.
   ```typescript
   export const environment = {
     production: true,
     apiUrl: 'https://tsek-backend.onrender.com' // Replace this
   };
   ```
3. Save and push your changes to GitHub.

---

## 4. Deploy Frontend (Vercel)
1. Go to [Vercel.com](https://vercel.com/) and sign in with GitHub.
2. Click **Add New** -> **Project**.
3. Import your repository.
4. In the configuration:
   - **Root Directory:** `tsek-frontend`
   - **Framework Preset:** `Angular`
5. Click **Deploy**.

---

## 5. Final Step: Verification
1. Visit your Vercel URL.
2. Try logging in or performing a scan.
3. If anything fails, check the **Logs** tab in Render for backend errors.
