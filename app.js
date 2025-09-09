// ----- Static front-end (SPA)

// Detect candidate frontend dirs
const candidates = [];
if (process.env.FEEDBACK_DIR) candidates.push(process.env.FEEDBACK_DIR);

const PUBLIC_DIR   = path.join(__dirname, 'public');
const FEEDBACK_DIR = path.join(__dirname, 'feedback');
const ROOT_DIR     = __dirname;

// Choose primary index directory (where index.html lives)
let FE_DIR = null;
for (const p of [
  process.env.FEEDBACK_DIR,
  path.join(__dirname, 'public', 'index.html'),
  path.join(__dirname, 'feedback', 'index.html'),
  path.join(__dirname, 'index.html'),
]) {
  if (p && fs.existsSync(p)) {
    FE_DIR = path.dirname(p);
    break;
  }
}
if (!FE_DIR) FE_DIR = ROOT_DIR;

// Serve static assets from multiple places so module imports like /routes/auth.js work
const staticDirs = [FE_DIR];
if (fs.existsSync(PUBLIC_DIR) && !staticDirs.includes(PUBLIC_DIR)) staticDirs.push(PUBLIC_DIR);
if (fs.existsSync(FEEDBACK_DIR) && !staticDirs.includes(FEEDBACK_DIR)) staticDirs.push(FEEDBACK_DIR);

// Mount them (primary first)
for (const dir of staticDirs) {
  app.use(express.static(dir, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    index: 'index.html',
  }));
}

// SPA fallback to the primary index.html
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();     // let API handle it
  if (path.extname(req.path)) return next();           // let static serve assets
  res.sendFile(path.join(FE_DIR, 'index.html'));
});
