# Quick guide for recording a demo video

## Timeline (~3 minutes)

| Time | Action | UI |
|------|--------|-----|
| 0:00–0:15 | Intro + UI overview | Login screen |
| 0:15–0:45 | Wallet connect | "Connect Wallet" → Phantom → Approve |
| 0:45–1:30 | AI contract generation | Prompt → Send → Show generated code |
| 1:30–2:20 | **Paste code + Audit + Rerun with patches** | New Project → Paste → Audit → Issues → Rerun → Patches applied |
| 2:20–2:50 | **Build with error + Auto-Fix & Rebuild** | Build → Error → Auto-Fix & Rebuild → Success |
| 2:50–3:10 | Deploy to Solana | Deploy → Devnet → Contract address |

**Note:** Section 3 (custom code) can replace or follow AI generation.

---

## Step-by-step

### 1. Wallet connection (~30s)
1. Show Login screen  
2. Click "Connect Wallet"  
3. Choose Phantom  
4. Approve in extension  
5. Show connected wallet (balance + address)

**Say:** "We use Solana Wallet Adapter. Supports Phantom, Solflare, Coin98, Trust Wallet."

---

### 2. AI generation (~45s)
1. Chat screen is open  
2. Scroll chat to bottom  
3. Focus input  
4. Type: `Create a staking contract for systematic staking rewards`  
5. Enter or Send  
6. Wait for generation animation  
7. Show generated Rust in editor  

**Say:** "AI generates Solana programs from natural language using Anchor. Code is persisted in LocalStorage."

---

### 3. Paste code + Audit + Rerun (~50s)

**Paste (~10s):** New Project → confirm → click editor → select all → paste Rust → show highlighting.

**First audit (~20s):** Audit → modal stages → show score (e.g. 45/100), issues, "Rerun Audit with Patches".

**Rerun (~20s):** Rerun → Apply Security Patches → re-analysis → rebuild → improved score (e.g. 85/100).

**Say:** First audit: "Several security issues; score 45/100." Rerun: "Patches applied, recompiled, score improved."

---

### 4. Build error + Auto-Fix (~30s)

**Failed build:** Build → stages → failure → error message → "Auto-Fix & Rebuild".

**Auto-fix:** Click Auto-Fix → AI Auto-Fix stage → full build stages again → success.

**Say:** "Build failed; AI can fix compile errors and rebuild."

---

### 5. Deploy (~20s)
1. After successful build, Deploy is active  
2. Open Deploy modal  
3. Choose Devnet if prompted  
4. Show stages → contract address → optional Explorer link  

**Say:** "Deployment uses Solana; wallet signs transactions; contract gets an on-chain address."

---

## Alternative flow (no AI generation)

| Time | Action |
|------|--------|
| 0:00–0:15 | Intro |
| 0:15–0:45 | Wallet |
| 0:45–1:25 | New Project → Paste → Review |
| 1:25–1:50 | Build |
| 1:50–2:15 | Deploy |
| 2:15–3:00 | Projects + UI |

---

### 6. UI / projects (optional)
Show navigation, project list, switching projects, header (Credits + Wallet), responsive resize.

**Say:** "Project-based layout; per-project history; LocalStorage; responsive."

---

## Checklist

- [ ] App running (`npm run dev`)
- [ ] Wallet installed
- [ ] Devnet SOL if needed
- [ ] Console clear
- [ ] Browser ~1920×1080, zoom 125–150%
- [ ] Cursor visible

---

## Talking points

- Solana Wallet Adapter  
- Next.js 15 App Router  
- WebSocket for live pipeline (when backend v3 is connected)  
- LocalStorage for quick restore  
- AI lowers the barrier to Solana development  
- Anchor as the standard framework  

---

## Troubleshooting

**Wallet:** reinstall extension, try Solflare, hard refresh.  
**Generation:** check Network tab, try another prompt, console errors.  
**Build/Deploy:** ensure code exists, SOL balance, Devnet RPC.

---

## Close-up shots

1. Header + wallet  
2. Chat input + Send  
3. Code editor in edit mode  
4. Paste into editor  
5. Review / Audit + modal  
6. Build modal stages  
7. Deploy modal + address  
8. Navigation / projects  

---

**Good luck.**
