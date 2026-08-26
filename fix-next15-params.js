const fs = require('fs');
const glob = require('glob');

// Fix route handlers: { params }: { params: { ... } } -> { params }: { params: Promise<{ ... }> }
const files = glob.sync('src/app/api/**/route.ts');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let changed = false;

  if (content.includes('params: {')) {
    // Replace { params }: { params: { xxx: string } } with context: { params: Promise<{ xxx: string }> }
    // Wait, it's easier to just use regex:
    const newContent = content.replace(
      /{ params }: { params: ({[^}]+}) }/g,
      'context: { params: Promise<$1> }'
    );
    if (newContent !== content) {
      // Also need to add `const params = await context.params;` at the start of the function body.
      // But we don't know the exact function signature. Let's do a more robust string replace.
    }
  }
}
