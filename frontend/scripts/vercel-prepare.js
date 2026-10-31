// Vercel build step: strips Emergent preview scripts/analytics from index.html (Emergent preview keeps them).
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "public", "index.html");
let html = fs.readFileSync(file, "utf8");
html = html
  .replace(/\s*<script src="https:\/\/assets\.emergent\.sh\/scripts\/emergent-main\.js"><\/script>/, "")
  .replace(/\s*<script>(?:(?!<\/script>)[\s\S])*posthog(?:(?!<\/script>)[\s\S])*<\/script>/, "")
  .replace('content="A product of emergent.sh"', 'content="Luma Petshop: köpek, kedi, kuş, balık ve kemirgen ürünleri. Online sipariş, adrese veya mağazadan teslim."');
if (/emergent\.sh|posthog/.test(html)) {
  console.error("vercel-prepare: Emergent scripts could not be removed from index.html");
  process.exit(1);
}
fs.writeFileSync(file, html);
console.log("vercel-prepare: index.html cleaned");
