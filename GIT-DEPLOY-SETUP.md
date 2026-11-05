# Git → Live auto-deploy setup (harinamjoli.in)

Setup ek baar karna hai. Uske baad `git push` karte hi website live pe update ho jaayegi.

**Kya deploy hota hai:** storefront ki 246 files (HTML, `css/`, `js/`, `assets/`, `index.php`, `.htaccess`), `public_html` me.
**Kya deploy NAHI hota:** `backups/`, `admin/`, `tests/`, `wordpress-plugin/`, `harinam-store-api/`, `dev-server.mjs`, `preview-server.mjs`, `.txt`/`.md` notes.
WordPress (`public_html/admin`), database aur uploads ko ye kabhi touch nahi karta.

---

## Step 1: iCloud se files download karo (zaroori)
Ye folder iCloud Documents me hai, aur bahut si files sirf cloud me hain, Mac pe nahi. Aisi files ke saath Git atak jaayega.

Finder → `Documents/Vivek Website` → **Harinam joli** folder pe right-click → **Keep Downloaded** (ya **Download Now**). Jab tak saari files ke aage se cloud ☁️ icon na hat jaaye, tab tak ruko.

## Step 2: cPanel me FTP account banao
cPanel → **Files → FTP Accounts** → *Add FTP Account*
- **Log In:** `deploy`, aur domain `harinamjoli.in` select karo
- **Password:** ek strong password generate karo aur kahin save kar lo
- **Directory:** ⚠️ cPanel yahan apne aap `public_html/deploy` bhar deta hai. Ise badal ke sirf **`public_html`** karo.
- **Quota:** Unlimited → *Create FTP Account*

## Step 3: GitHub pe private repo banao
github.com → **New repository**
- Name: `harinam-joli`, **Private** select karo
- README, .gitignore wagairah kuch bhi add mat karo → *Create repository*

## Step 4: GitHub me 3 secrets daalo
Repo → **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|---|---|
| `FTP_SERVER` | `sg2plzcpnl507451.prod.sin2.secureserver.net` |
| `FTP_USERNAME` | `deploy@harinamjoli.in` |
| `FTP_PASSWORD` | Step 2 wala password |

## Step 5: Code push karo (pehli baar)
⚠️ Pehle push me aapke Mac wali saari files live pe chali jaayengi. Inme wo changes bhi honge jo abhi tak live nahi hue (jaise `products.html`, jo release ke baad edit hui thi). Isliye push se pehle local pe site check kar lo.

Terminal me ye commands chalao (`<your-username>` ki jagah apna GitHub username daalo):

```bash
cd "/Users/bhaktidesign7/Documents/Vivek Website/Harinam joli"
git init -b main
git add .
git commit -m "Initial storefront code"
git remote add origin https://github.com/<your-username>/harinam-joli.git
git push -u origin main
```

Repo → **Actions** tab kholo. Pehli baar saari 246 files (~18 MB) upload hongi, to 2-5 minute lag sakte hain. Green ✅ aaye to https://harinamjoli.in check karo.

**Agar red ❌ aaye aur error me "TLS" ya "certificate" likha ho:** cPanel ke Configure FTP Client me server hostname aur uska certificate verify karo. Workflow me `protocol: ftps` rakho.

---

## Roz ka kaam (setup ke baad)

```bash
git add .
git commit -m "kya badla, short me likho"
git push
```

Ab sirf badli hui files upload hongi, to deploy kuch hi second me ho jaayega.

**Galti ho gayi? Pichla version wapas laao:**
```bash
git revert HEAD
git push
```

## Store API plugin
`harinam-store-api` plugin abhi bhi pehle jaisa hi update hoga (WordPress → Plugins → Upload Plugin). Ye checkout aur payments chalata hai, isliye ise auto-deploy me nahi daala gaya. Agar baad me iska bhi auto-deploy chahiye, to ek alag FTP account (`public_html/admin/wp-content/plugins/harinam-store-api`) ke saath ek doosra job add kiya ja sakta hai.
