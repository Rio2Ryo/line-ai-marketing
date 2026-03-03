import { Hono } from 'hono';
import { Env } from '../types';
import { authMiddleware, roleMiddleware } from '../middleware/auth';

type Variables = {
  userId: string;
  userRole: string;
};

export const importRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

importRoutes.use('*', authMiddleware);
// Only admin and operator can import
importRoutes.use('*', roleMiddleware('admin', 'operator'));

function generateId(): string {
  return crypto.randomUUID();
}

// CSV parser (handles quoted fields, commas in values, Japanese text)
function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  // Remove BOM if present
  const cleaned = text.replace(/^\uFEFF/, '');
  const lines: string[] = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === '"') {
      if (inQuote && i + 1 < cleaned.length && cleaned[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && i + 1 < cleaned.length && cleaned[i + 1] === '\n') i++;
      if (current.trim()) lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };

  function splitRow(line: string): string[] {
    const fields: string[] = [];
    let field = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && i + 1 < line.length && line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === ',' && !inQ) {
        fields.push(field.trim());
        field = '';
      } else {
        field += ch;
      }
    }
    fields.push(field.trim());
    return fields;
  }

  const headers = splitRow(lines[0]);
  const rows = lines.slice(1).map(l => splitRow(l));
  return { headers, rows };
}

interface ValidationResult {
  valid: boolean;
  row: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
}

// POST /api/import/preview — Parse and validate without inserting
importRoutes.post('/preview', async (c) => {
  try {
    const body = await c.req.json<{ target: string; format: string; data: string }>();
    const { target, format, data } = body;

    if (!target || !data) {
      return c.json({ success: false, error: 'target and data are required' }, 400);
    }

    if (!['customers', 'tags', 'knowledge'].includes(target)) {
      return c.json({ success: false, error: 'Invalid target. Must be: customers, tags, or knowledge' }, 400);
    }

    let records: Record<string, string>[] = [];

    if (format === 'csv') {
      const { headers, rows } = parseCsv(data);
      if (headers.length === 0) {
        return c.json({ success: false, error: 'CSV is empty or invalid' }, 400);
      }
      records = rows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
      });
    } else if (format === 'json') {
      try {
        const parsed = JSON.parse(data);
        records = Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return c.json({ success: false, error: 'Invalid JSON format' }, 400);
      }
    } else {
      return c.json({ success: false, error: 'Invalid format. Must be: csv or json' }, 400);
    }

    // Validate each row
    const results: ValidationResult[] = records.map((record, index) => {
      const errors: string[] = [];
      const warnings: string[] = [];

      switch (target) {
        case 'customers':
          if (!record.display_name && !record.name) errors.push('display_name is required');
          if (record.status && !['active', 'blocked', 'unfollowed'].includes(record.status)) {
            warnings.push('Invalid status, will default to "active"');
          }
          break;
        case 'tags':
          if (!record.name) errors.push('name is required');
          if (record.color && !/^#[0-9A-Fa-f]{6}$/.test(record.color)) {
            warnings.push('Invalid color format, will default to #06C755');
          }
          break;
        case 'knowledge':
          if (!record.title) errors.push('title is required');
          if (!record.content) errors.push('content is required');
          break;
      }

      return {
        valid: errors.length === 0,
        row: index + 1,
        data: record,
        errors,
        warnings,
      };
    });

    const validCount = results.filter(r => r.valid).length;
    const errorCount = results.filter(r => !r.valid).length;

    return c.json({
      success: true,
      data: {
        target,
        total: results.length,
        valid: validCount,
        errors: errorCount,
        preview: results.slice(0, 100), // Limit preview to 100 rows
      },
    });
  } catch (e) {
    return c.json({ success: false, error: 'Failed to parse data: ' + String(e) }, 400);
  }
});

// POST /api/import/customers — Import customers
importRoutes.post('/customers', async (c) => {
  try {
    const body = await c.req.json<{ format: string; data: string }>();
    let records: Record<string, string>[] = [];

    if (body.format === 'csv') {
      const { headers, rows } = parseCsv(body.data);
      records = rows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
      });
    } else {
      records = JSON.parse(body.data);
      if (!Array.isArray(records)) records = [records];
    }

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const record of records) {
      const displayName = record.display_name || record.name || '';
      if (!displayName) { skipped++; continue; }

      const id = generateId();
      const lineUserId = record.line_user_id || `imported_${id}`;
      const status = ['active', 'blocked', 'unfollowed'].includes(record.status || '') ? record.status : 'active';

      try {
        // Check if line_user_id already exists
        if (record.line_user_id) {
          const existing = await c.env.DB.prepare('SELECT id FROM users WHERE line_user_id = ?').bind(record.line_user_id).first();
          if (existing) {
            skipped++;
            continue;
          }
        }

        await c.env.DB.prepare(
          "INSERT INTO users (id, line_user_id, display_name, status, created_at, updated_at) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))"
        ).bind(id, lineUserId, displayName, status).run();

        // Handle tags (comma-separated tag names)
        if (record.tags) {
          const tagNames = record.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
          for (const tagName of tagNames) {
            // Find or create tag
            let tag = await c.env.DB.prepare('SELECT id FROM tags WHERE name = ?').bind(tagName).first();
            if (!tag) {
              const tagId = generateId();
              await c.env.DB.prepare("INSERT INTO tags (id, name, color) VALUES (?, ?, '#06C755')").bind(tagId, tagName).run();
              tag = { id: tagId };
            }
            await c.env.DB.prepare('INSERT OR IGNORE INTO user_tags (user_id, tag_id) VALUES (?, ?)').bind(id, tag.id).run();
          }
        }

        imported++;
      } catch (e) {
        errors.push(`Row ${imported + skipped + 1}: ${String(e)}`);
        skipped++;
      }
    }

    return c.json({
      success: true,
      data: { imported, skipped, errors: errors.slice(0, 10), total: records.length },
    });
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});

// POST /api/import/tags — Import tags
importRoutes.post('/tags', async (c) => {
  try {
    const body = await c.req.json<{ format: string; data: string }>();
    let records: Record<string, string>[] = [];

    if (body.format === 'csv') {
      const { headers, rows } = parseCsv(body.data);
      records = rows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
      });
    } else {
      records = JSON.parse(body.data);
      if (!Array.isArray(records)) records = [records];
    }

    let imported = 0;
    let skipped = 0;

    for (const record of records) {
      if (!record.name) { skipped++; continue; }

      // Skip duplicates
      const existing = await c.env.DB.prepare('SELECT id FROM tags WHERE name = ?').bind(record.name).first();
      if (existing) { skipped++; continue; }

      const color = /^#[0-9A-Fa-f]{6}$/.test(record.color || '') ? record.color : '#06C755';
      const id = generateId();

      try {
        await c.env.DB.prepare(
          "INSERT INTO tags (id, name, color, description, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
        ).bind(id, record.name, color, record.description || null).run();
        imported++;
      } catch {
        skipped++;
      }
    }

    return c.json({
      success: true,
      data: { imported, skipped, total: records.length },
    });
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});

// POST /api/import/knowledge — Import knowledge base entries
importRoutes.post('/knowledge', async (c) => {
  try {
    const body = await c.req.json<{ format: string; data: string }>();
    let records: Record<string, string>[] = [];

    if (body.format === 'csv') {
      const { headers, rows } = parseCsv(body.data);
      records = rows.map(row => {
        const obj: Record<string, string> = {};
        headers.forEach((h, i) => { obj[h] = row[i] || ''; });
        return obj;
      });
    } else {
      records = JSON.parse(body.data);
      if (!Array.isArray(records)) records = [records];
    }

    let imported = 0;
    let skipped = 0;

    for (const record of records) {
      if (!record.title || !record.content) { skipped++; continue; }

      const id = generateId();
      try {
        await c.env.DB.prepare(
          "INSERT INTO knowledge_base (id, title, content, category, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))"
        ).bind(id, record.title, record.content, record.category || null).run();
        imported++;
      } catch {
        skipped++;
      }
    }

    return c.json({
      success: true,
      data: { imported, skipped, total: records.length },
    });
  } catch (e) {
    return c.json({ success: false, error: String(e) }, 500);
  }
});
