const chokidar = require('chokidar');
const { execSync } = require('child_process');

const paths = ['src/index.html', 'src/components'];

const watcher = chokidar.watch(paths, { ignoreInitial: true });

watcher.on('all', (event, path) => {
  console.log(new Date().toISOString(), event, path);
  try {
    // inject env values into src/index.html before building
  try { execSync('node scripts/inject-env-html.js', { stdio: 'inherit' }); } catch (e) { console.error('inject-env-html failed:', e && e.message ? e.message : e); }
  execSync('npx posthtml tmp/index.injected.html -o public/index.html -c posthtml.config.js', { stdio: 'inherit' });
  } catch (e) {
    console.error('posthtml failed:', e.message || e);
  }
  try {
    execSync('npm run copy:components', { stdio: 'inherit' });
  } catch (e) {
    console.error('copy:components failed:', e.message || e);
  }
});

console.log('watch-posthtml: watching', paths.join(', '));
