import fs from 'fs';
import { parse } from '@babel/parser';

const code = fs.readFileSync('src/pages/admin/Students.jsx', 'utf-8');

try {
    parse(code, {
        sourceType: 'module',
        plugins: ['jsx']
    });
    console.log('Parse successful!');
} catch (e) {
    console.error('Parse error:', e.message);
    const lines = code.split('\n');
    console.log('Error around line', e.loc.line);
    for (let i = Math.max(0, e.loc.line - 5); i < Math.min(lines.length, e.loc.line + 5); i++) {
        console.log(`${i + 1}: ${lines[i]}`);
    }
}
