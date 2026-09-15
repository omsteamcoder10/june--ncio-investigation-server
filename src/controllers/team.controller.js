const path = require('path');
const crypto = require('crypto');

const pool = require('../plugins/db');
const {
  uploadToR2,
  deleteFromR2,
} = require('../services/r2.service');

/**
 * Convert Base64 image data URL into a Buffer.
 *
 * Example:
 * data:image/webp;base64,AAAA...
 */
function parseBase64Image(dataUrl) {
  if (
    typeof dataUrl !== 'string' ||
    !dataUrl.trim()
  ) {
    return null;
  }

  const match = dataUrl.match(
    /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/
  );

  if (!match) {
    throw new Error(
      'Invalid image format. Expected Base64 image data.'
    );
  }

  const contentType = match[1];
  const base64Data = match[2];

  const buffer = Buffer.from(
    base64Data,
    'base64'
  );

  if (!buffer.length) {
    throw new Error('Image data is empty');
  }

  const extensionMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
  };

  const extension =
    extensionMap[contentType] || 'webp';

  return {
    buffer,
    contentType,
    extension,
  };
}

/**
 * Create a safe unique filename for R2.
 */
function createTeamFilename(
  originalName,
  extension
) {
  let baseName = 'team-member';

  if (
    typeof originalName === 'string' &&
    originalName.trim()
  ) {
    baseName = path
      .basename(originalName)
      .replace(/\.[^/.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
  }

  if (!baseName) {
    baseName = 'team-member';
  }

  const uniqueId = crypto
    .randomBytes(6)
    .toString('hex');

  return `${baseName}-${uniqueId}.${extension}`;
}

/**
 * Process Team photo.
 *
 * If photo is already an R2/backend path,
 * keep it as it is.
 *
 * If photo is Base64:
 *
 * Base64
 *   ↓
 * Buffer
 *   ↓
 * R2 team/
 *   ↓
 * /files/team/filename.webp
 */
async function processTeamPhoto(
  photo,
  photoName
) {
  if (
    typeof photo !== 'string' ||
    !photo.trim()
  ) {
    return null;
  }

  const trimmedPhoto = photo.trim();

  // Already stored Team R2 path.
  if (
    trimmedPhoto.startsWith('/files/team/')
  ) {
    return trimmedPhoto;
  }

  // Keep any existing backend file path.
  if (
    trimmedPhoto.startsWith('/files/')
  ) {
    return trimmedPhoto;
  }

  // Convert Base64 image.
  const parsed = parseBase64Image(
    trimmedPhoto
  );

  if (!parsed) {
    return null;
  }

  const filename = createTeamFilename(
    photoName || 'team-member',
    parsed.extension
  );

  const r2Url = await uploadToR2(
    parsed.buffer,
    filename,
    parsed.contentType,
    'team'
  );

  return r2Url;
};

/**
 * GET active Team members
 */
const getAllTeam = async (
  request,
  reply
) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM team_members
       WHERE is_active = true
       ORDER BY display_order ASC, created_at ASC`
    );

    return result.rows;
  } catch (err) {
    console.error(
      'GET TEAM ERROR:',
      err
    );

    return reply.code(500).send({
      error: err.message,
    });
  }
};

/**
 * GET all Team members for Admin
 */
const getAllTeamAdmin = async (
  request,
  reply
) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM team_members
       ORDER BY display_order ASC, created_at ASC`
    );

    return result.rows;
  } catch (err) {
    console.error(
      'GET ADMIN TEAM ERROR:',
      err
    );

    return reply.code(500).send({
      error: err.message,
    });
  }
};

/**
 * ADD Team member
 */
const addTeamMember = async (
  request,
  reply
) => {
  const {
    name,
    role,
    district,
    photo,
    photoName,
    greeting,
    display_order,
  } = request.body || {};

  try {
    const r2Photo =
      await processTeamPhoto(
        photo,
        photoName
      );

    const result = await pool.query(
      `INSERT INTO team_members
        (
          name,
          role,
          district,
          photo,
          greeting,
          display_order
        )
       VALUES
        ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        typeof name === 'string'
          ? name.trim()
          : '',

        typeof role === 'string'
          ? role.trim()
          : '',

        typeof district === 'string'
          ? district.trim()
          : '',

        r2Photo,

        typeof greeting === 'string' &&
        greeting.trim()
          ? greeting.trim()
          : null,

        Number.isFinite(
          Number(display_order)
        )
          ? Number(display_order)
          : 0,
      ]
    );

    return reply
      .code(201)
      .send(result.rows[0]);
  } catch (err) {
    console.error(
      'TEAM INSERT ERROR:',
      err
    );

    return reply.code(500).send({
      error: err.message,
    });
  }
};

/**
 * UPDATE Team member
 */
const updateTeamMember = async (
  request,
  reply
) => {
  const {
    name,
    role,
    district,
    photo,
    photoName,
    greeting,
    display_order,
    is_active,
  } = request.body || {};

  try {
    // Get existing member first.
    const existingResult =
      await pool.query(
        `SELECT *
         FROM team_members
         WHERE id = $1`,
        [request.params.id]
      );

    const existingMember =
      existingResult.rows[0];

    if (!existingMember) {
      return reply.code(404).send({
        error: 'Member not found',
      });
    }

    let r2Photo =
      existingMember.photo || null;

    // If a new Base64 image is supplied,
    // upload it to R2.
    if (
      typeof photo === 'string' &&
      photo.trim()
    ) {
      const newPhoto =
        await processTeamPhoto(
          photo,
          photoName
        );

      if (newPhoto) {
        r2Photo = newPhoto;

        // Delete old R2 image only when
        // replacing it with a new image.
        if (
          existingMember.photo &&
          existingMember.photo.startsWith(
            '/files/'
          ) &&
          existingMember.photo !== newPhoto
        ) {
          await deleteFromR2(
            existingMember.photo
          );
        }
      }
    }

    const result = await pool.query(
      `UPDATE team_members
       SET
         name = $1,
         role = $2,
         district = $3,
         photo = $4,
         greeting = $5,
         display_order = $6,
         is_active = $7
       WHERE id = $8
       RETURNING *`,
      [
        typeof name === 'string'
          ? name.trim()
          : '',

        typeof role === 'string'
          ? role.trim()
          : '',

        typeof district === 'string'
          ? district.trim()
          : '',

        r2Photo,

        typeof greeting === 'string' &&
        greeting.trim()
          ? greeting.trim()
          : null,

        Number.isFinite(
          Number(display_order)
        )
          ? Number(display_order)
          : 0,

        is_active ?? true,

        request.params.id,
      ]
    );

    return result.rows[0];
  } catch (err) {
    console.error(
      'TEAM UPDATE ERROR:',
      err
    );

    return reply.code(500).send({
      error: err.message,
    });
  }
};

/**
 * DELETE Team member
 *
 * Also removes the image from R2.
 */
const deleteTeamMember = async (
  request,
  reply
) => {
  try {
    // Get photo before deleting DB row.
    const existingResult =
      await pool.query(
        `SELECT photo
         FROM team_members
         WHERE id = $1`,
        [request.params.id]
      );

    const existingMember =
      existingResult.rows[0];

    if (!existingMember) {
      return reply.code(404).send({
        error: 'Member not found',
      });
    }

    const result = await pool.query(
      `DELETE FROM team_members
       WHERE id = $1
       RETURNING id`,
      [request.params.id]
    );

    if (!result.rows[0]) {
      return reply.code(404).send({
        error: 'Member not found',
      });
    }

    // Delete corresponding R2 file.
    if (
      existingMember.photo &&
      existingMember.photo.startsWith(
        '/files/'
      )
    ) {
      await deleteFromR2(
        existingMember.photo
      );
    }

    return {
      message: 'Team member deleted',
    };
  } catch (err) {
    console.error(
      'DELETE TEAM ERROR:',
      err
    );

    return reply.code(500).send({
      error: err.message,
    });
  }
};

module.exports = {
  getAllTeam,
  getAllTeamAdmin,
  addTeamMember,
  updateTeamMember,
  deleteTeamMember,
};