const path = require('path');
const crypto = require('crypto');

const pool = require('../plugins/db');

const {
  uploadToR2,
  deleteFromR2,
} = require('../services/r2.service');

/**
 * =========================================================
 * PARSE BASE64 IMAGE
 * =========================================================
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
    throw new Error(
      'Image data is empty'
    );
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
 * =========================================================
 * CREATE UNIQUE TEAM FILENAME
 * =========================================================
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
 * =========================================================
 * PROCESS TEAM PHOTO
 * =========================================================
 *
 * Existing DB photo:
 * /files/team/member.webp
 *
 * Keep unchanged.
 *
 * New Base64:
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

  const trimmedPhoto =
    photo.trim();

  /**
   * Existing Team R2 path.
   *
   * IMPORTANT:
   * Do NOT upload again.
   */
  if (
    trimmedPhoto.startsWith(
      '/files/team/'
    )
  ) {
    return trimmedPhoto;
  }

  /**
   * Other existing backend R2 path.
   */
  if (
    trimmedPhoto.startsWith(
      '/files/'
    )
  ) {
    return trimmedPhoto;
  }

  /**
   * New Base64 image.
   */
  const parsed =
    parseBase64Image(
      trimmedPhoto
    );

  if (!parsed) {
    return null;
  }

  const filename =
    createTeamFilename(
      photoName ||
        'team-member',
      parsed.extension
    );

  const r2Url =
    await uploadToR2(
      parsed.buffer,
      filename,
      parsed.contentType,
      'team'
    );

  return r2Url;
}

/**
 * =========================================================
 * GET ACTIVE TEAM
 * =========================================================
 */

const getAllTeam = async (
  request,
  reply
) => {
  try {
    const result =
      await pool.query(`
        SELECT *
        FROM team_members
        WHERE is_active = true
        ORDER BY display_order ASC, created_at ASC
      `);

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
 * =========================================================
 * GET ALL TEAM FOR ADMIN
 * =========================================================
 */

const getAllTeamAdmin = async (
  request,
  reply
) => {
  try {
    const result =
      await pool.query(`
        SELECT *
        FROM team_members
        ORDER BY display_order ASC, created_at ASC
      `);

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
 * =========================================================
 * ADD TEAM MEMBER
 * =========================================================
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
    is_active,
  } = request.body || {};

  try {
    /**
     * Upload new photo to R2.
     */
    const r2Photo =
      await processTeamPhoto(
        photo,
        photoName
      );

    if (!r2Photo) {
      return reply.code(400).send({
        error:
          'Team member photo is required',
      });
    }

    /**
     * DB INSERT.
     *
     * No schema change.
     */
    const result =
      await pool.query(
        `
        INSERT INTO team_members
        (
          name,
          role,
          district,
          photo,
          greeting,
          display_order,
          is_active
        )
        VALUES
        ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        `,
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
 * =========================================================
 * UPDATE TEAM MEMBER
 * =========================================================
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
    /**
     * Get existing member.
     */
    const existingResult =
      await pool.query(
        `
        SELECT *
        FROM team_members
        WHERE id = $1
        `,
        [request.params.id]
      );

    const existingMember =
      existingResult.rows[0];

    if (!existingMember) {
      return reply.code(404).send({
        error: 'Member not found',
      });
    }

    /**
     * Default:
     * Keep existing R2 photo.
     */
    let r2Photo =
      existingMember.photo || null;

    /**
     * Only process photo when a
     * NEW Base64 photo is supplied.
     */
    if (
      typeof photo === 'string' &&
      photo.trim()
    ) {
      const trimmedPhoto =
        photo.trim();

      /**
       * If frontend sends the same
       * existing R2 path, do nothing.
       */
      if (
        trimmedPhoto ===
        existingMember.photo
      ) {
        r2Photo =
          existingMember.photo;
      } else {
        /**
         * New image.
         */
        const newPhoto =
          await processTeamPhoto(
            trimmedPhoto,
            photoName
          );

        if (newPhoto) {
          r2Photo = newPhoto;

          /**
           * Delete OLD R2 image.
           *
           * This happens only after
           * a new image has been uploaded.
           */
          if (
            existingMember.photo &&
            existingMember.photo.startsWith(
              '/files/'
            ) &&
            existingMember.photo !==
              newPhoto
          ) {
            try {
              await deleteFromR2(
                existingMember.photo
              );

              console.log(
                'OLD TEAM IMAGE DELETED:',
                existingMember.photo
              );
            } catch (deleteError) {
              /**
               * Do not fail the whole
               * DB update if old R2
               * cleanup fails.
               */
              console.error(
                'OLD TEAM IMAGE DELETE ERROR:',
                deleteError
              );
            }
          }
        }
      }
    }

    /**
     * UPDATE DB.
     *
     * Same existing table.
     * No migration/schema change.
     */
    const result =
      await pool.query(
        `
        UPDATE team_members
        SET
          name = $1,
          role = $2,
          district = $3,
          photo = $4,
          greeting = $5,
          display_order = $6,
          is_active = $7
        WHERE id = $8
        RETURNING *
        `,
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
 * =========================================================
 * DELETE TEAM MEMBER
 * =========================================================
 *
 * Admin Delete:
 *
 * 1. Get DB photo path
 * 2. Delete DB row
 * 3. Delete corresponding R2 file
 *
 * DB schema remains unchanged.
 */

const deleteTeamMember = async (
  request,
  reply
) => {
  try {
    /**
     * Get existing photo first.
     */
    const existingResult =
      await pool.query(
        `
        SELECT photo
        FROM team_members
        WHERE id = $1
        `,
        [request.params.id]
      );

    const existingMember =
      existingResult.rows[0];

    if (!existingMember) {
      return reply.code(404).send({
        error: 'Member not found',
      });
    }

    /**
     * Delete DB row.
     */
    const result =
      await pool.query(
        `
        DELETE FROM team_members
        WHERE id = $1
        RETURNING id
        `,
        [request.params.id]
      );

    if (!result.rows[0]) {
      return reply.code(404).send({
        error: 'Member not found',
      });
    }

    /**
     * Delete corresponding R2 file.
     */
    if (
      existingMember.photo &&
      existingMember.photo.startsWith(
        '/files/'
      )
    ) {
      try {
        await deleteFromR2(
          existingMember.photo
        );

        console.log(
          'TEAM R2 IMAGE DELETED:',
          existingMember.photo
        );
      } catch (r2Error) {
        /**
         * DB delete already succeeded.
         * Log R2 cleanup error.
         */
        console.error(
          'TEAM R2 DELETE ERROR:',
          r2Error
        );
      }
    }

    return {
      message:
        'Team member deleted successfully',
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