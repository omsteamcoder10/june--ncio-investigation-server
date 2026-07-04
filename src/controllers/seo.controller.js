const fs = require('fs');
const path = require('path');
const pool = require('../plugins/db');

const clientAppDir = path.resolve(__dirname, '../../../client/app');
const clientConstantsFile = path.resolve(__dirname, '../../../client/lib/constants.ts');

const titleFromSegment = (segment) => {
  if (!segment || segment === '/') return 'Home';

  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getRouteSection = (slug) => {
  if (slug === '/') return 'Home';
  return titleFromSegment(slug.split('/').filter(Boolean)[0]);
};

const getPageNameFromSlug = (slug) => {
  if (slug === '/') return 'Home';
  const parts = slug.split('/').filter(Boolean);
  return titleFromSegment(parts[parts.length - 1]);
};

const walkPageFiles = (dir) => {
  if (!fs.existsSync(dir)) return [];

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name.startsWith('_') || entry.name.startsWith('(')) return [];
      return walkPageFiles(fullPath);
    }

    return entry.isFile() && /^page\.(tsx|ts|jsx|js)$/.test(entry.name) ? [fullPath] : [];
  });
};

const readServicePages = () => {
  if (!fs.existsSync(clientConstantsFile)) return [];

  const constants = fs.readFileSync(clientConstantsFile, 'utf8');
  const servicesMatch = constants.match(/export\s+const\s+SERVICES[\s\S]*?=\s*\[([\s\S]*?)\];/);
  if (!servicesMatch) return [];

  const services = [];
  const serviceRegex = /id:\s*["']([^"']+)["'][\s\S]*?title:\s*["']([^"']+)["']/g;
  let match;

  while ((match = serviceRegex.exec(servicesMatch[1])) !== null) {
    services.push({
      slug: `/services/${match[1]}`,
      page_name: match[2],
      section: 'Services',
    });
  }

  return services;
};

const discoverClientPages = () => {
  const pages = new Map();

  for (const filePath of walkPageFiles(clientAppDir)) {
    const routeDir = path.dirname(path.relative(clientAppDir, filePath));
    const segments = routeDir === '.' ? [] : routeDir.split(path.sep);

    if (segments.some((segment) => segment.startsWith('['))) {
      if (segments.join('/') === 'services/[slug]') {
        for (const service of readServicePages()) {
          pages.set(service.slug, service);
        }
      }
      continue;
    }

    const slug = segments.length ? `/${segments.join('/')}` : '/';
    pages.set(slug, {
      slug,
      page_name: getPageNameFromSlug(slug),
      section: getRouteSection(slug),
    });
  }

  return [...pages.values()].sort((a, b) => {
    if (a.section !== b.section) return a.section.localeCompare(b.section);
    return a.slug.localeCompare(b.slug);
  });
};

const syncDiscoveredSeoPages = async () => {
  const discoveredPages = discoverClientPages();
  if (discoveredPages.length === 0) return;

  const existing = await pool.query('SELECT slug FROM seo_settings');
  const existingSlugs = new Set(existing.rows.map((row) => row.slug));

  for (const page of discoveredPages) {
    if (existingSlugs.has(page.slug)) {
      await pool.query(
        'UPDATE seo_settings SET page_name=$1 WHERE slug=$2 AND page_name IS DISTINCT FROM $1',
        [page.page_name, page.slug]
      );
      continue;
    }

    await pool.query(
      `INSERT INTO seo_settings
       (page_name, slug, meta_title, meta_description, meta_keywords, og_image)
       VALUES ($1, $2, '', '', '', '')`,
      [page.page_name, page.slug]
    );
  }
};

const getSeoSettings = async (request, reply) => {
  try {
    await syncDiscoveredSeoPages();
    const result = await pool.query(
      `SELECT *,
        CASE
          WHEN slug = '/' THEN 'Home'
          ELSE initcap(split_part(trim(leading '/' from slug), '/', 1))
        END AS section
       FROM seo_settings
       ORDER BY section, slug`
    );
    reply.send({ success: true, data: result.rows });
  } catch (err) {
    reply.status(500).send({ success: false, message: err.message });
  }
};

const getSeoBySlug = async (request, reply) => {
  try {
    const { slug } = request.params;
    const result = await pool.query(
      'SELECT * FROM seo_settings WHERE slug = $1',
      [decodeURIComponent(slug)]
    );
    if (result.rows.length === 0) {
      return reply.status(404).send({ success: false, message: 'Not found' });
    }
    reply.send({ success: true, data: result.rows[0] });
  } catch (err) {
    reply.status(500).send({ success: false, message: err.message });
  }
};

const updateSeoSettings = async (request, reply) => {
  try {
    const { id } = request.params;
    const { meta_title, meta_description, meta_keywords, og_image } = request.body;
    const result = await pool.query(
      `UPDATE seo_settings 
       SET meta_title=$1, meta_description=$2, meta_keywords=$3, og_image=$4, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [meta_title, meta_description, meta_keywords, og_image, id]
    );
    reply.send({ success: true, data: result.rows[0] });
  } catch (err) {
    reply.status(500).send({ success: false, message: err.message });
  }
};

module.exports = { getSeoSettings, getSeoBySlug, updateSeoSettings };
