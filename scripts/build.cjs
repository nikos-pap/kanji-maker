// The generated page works offline, including through file: URLs.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const script = text => text.replace(/<\/script/gi, '<\\/script');
const check = process.argv.includes('--check');
const fontBytes = fs.readFileSync(path.join(root, 'assets/fonts/N5PDFSerif-Regular.ttf'));
const fontkit = require(path.join(root, 'assets/vendor/fontkit-1.1.1.min.js'));
const fontCopyright = fontkit.create(new Uint8Array(fontBytes)).copyright;
let html = read('src/index.html');
for (const [marker, value] of Object.entries({
  CSS: read('src/style.css'),
  FONTKIT: script(read('assets/vendor/fontkit-1.1.1.min.js')),
  FONT: fontBytes.toString('base64'),
  LICENSE: JSON.stringify(`${fontCopyright}\n\n${read('assets/fonts/OFL.txt')}`).slice(1, -1),
  APP: script(read('src/exports.js') + '\n' + read('src/app.js')),
})) {
  const token = `/* BUILD:${marker} */`;
  if (html.split(token).length !== 2) throw new Error(`Expected one ${token}`);
  html = html.replace(token, () => value);
}
html = html.replace('<!-- BUILD:VENDORLICENSE -->', () => `<!-- Bundled fontkit licence:\n${read('assets/vendor/fontkit-LICENSE.txt').replace(/--/g, '—')}\n-->`);
if (/BUILD:/.test(html)) throw new Error('Unresolved build marker');
const target = path.join(root, 'kanji_maker.html');
if (check) {
  if (!fs.existsSync(target) || read('kanji_maker.html') !== html) {
    console.error('kanji_maker.html is out of date. Run npm run build and commit the result.');
    process.exitCode = 1;
  } else console.log('Generated page matches the editable sources.');
} else {
  fs.writeFileSync(target, html);
  console.log(`Built kanji_maker.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB including font).`);
}
