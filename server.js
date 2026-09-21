import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Parse port from args (e.g. --port 3000) or env
let port = 3000;
const portArgIndex = process.argv.indexOf('--port');
if (portArgIndex !== -1 && process.argv[portArgIndex + 1]) {
  port = parseInt(process.argv[portArgIndex + 1], 10);
} else if (process.env.PORT) {
  port = parseInt(process.env.PORT, 10);
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Object storage path configuration
const STORAGE_OBJECT_PATH = 'data/contactReceived.json';
const LOCAL_STORAGE_PATH = path.join(__dirname, 'data', 'contactReceived.json');

// Ensure local data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fsSync.existsSync(dataDir)) {
  fsSync.mkdirSync(dataDir, { recursive: true });
}

// Initialize Replit Object Storage client only if running in a verified Replit environment
let replitClient = null;
const isReplitEnvironment = Boolean(
  process.env.REPL_ID ||
  process.env.REPLIT_ENVIRONMENT ||
  process.env.REPL_SLUG ||
  process.env.REPL_OWNER
);

if (isReplitEnvironment) {
  try {
    const { Client } = await import('@replit/object-storage');
    replitClient = new Client();
  } catch {
    replitClient = null;
  }
}

/**
 * Read contact data from storage (Replit Object Storage or local filesystem fallback)
 * Returns array of submissions
 */
async function readContactSubmissions() {
  // Try Replit App Storage first if running in an active Replit environment
  if (replitClient) {
    try {
      const exists = await replitClient.exists(STORAGE_OBJECT_PATH);
      if (exists.ok && exists.value) {
        const downloadResult = await replitClient.downloadAsText(STORAGE_OBJECT_PATH);
        if (downloadResult.ok) {
          const parsed = JSON.parse(downloadResult.value);
          if (Array.isArray(parsed)) {
            // Also sync to local file for filesystem inspection
            await fs.writeFile(LOCAL_STORAGE_PATH, JSON.stringify(parsed, null, 2), 'utf-8').catch(() => {});
            return parsed;
          }
        }
      } else if (exists.ok && !exists.value) {
        // Initialize empty array in Replit Object Storage
        await replitClient.uploadFromText(STORAGE_OBJECT_PATH, JSON.stringify([], null, 2));
      }
    } catch {
      // Gracefully switch to filesystem without logging noisy warnings
      replitClient = null;
    }
  }

  // Fallback to local filesystem storage (primary for local and container environments)
  try {
    if (fsSync.existsSync(LOCAL_STORAGE_PATH)) {
      const fileContent = await fs.readFile(LOCAL_STORAGE_PATH, 'utf-8');
      const trimmed = fileContent.trim();
      if (!trimmed) {
        await fs.writeFile(LOCAL_STORAGE_PATH, '[]', 'utf-8');
        return [];
      }
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } else {
      await fs.writeFile(LOCAL_STORAGE_PATH, '[]', 'utf-8');
      return [];
    }
  } catch (err) {
    console.error('Error reading local contactReceived.json:', err);
    throw new Error('Failed to read contact storage');
  }
}

/**
 * Write contact data to storage (Replit Object Storage and local file)
 */
async function writeContactSubmissions(submissions) {
  const jsonString = JSON.stringify(submissions, null, 2);
  let writeSuccess = false;

  // Attempt write to Replit Object Storage if active
  if (replitClient) {
    try {
      const uploadResult = await replitClient.uploadFromText(STORAGE_OBJECT_PATH, jsonString);
      if (uploadResult.ok) {
        writeSuccess = true;
      }
    } catch {
      replitClient = null;
    }
  }

  // Always write to local filesystem storage as well for durability & acceptance tests
  try {
    await fs.writeFile(LOCAL_STORAGE_PATH, jsonString, 'utf-8');
    writeSuccess = true;
  } catch (err) {
    console.error('Filesystem storage write error:', err);
    if (!writeSuccess) {
      throw new Error('Failed to write contact storage');
    }
  }

  return writeSuccess;
}

// Ensure initial file exists upon server boot
try {
  await readContactSubmissions();
} catch (e) {
  // Silent fallback
}

// --------------------------------------------------------------------------
// API ROUTES
// --------------------------------------------------------------------------

const VALID_REASONS = ['Comment', 'Question', 'Partnership', 'Opportunity', 'Other'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/contact
 * Handles contact form submissions
 */
app.post('/api/contact', async (req, res) => {
  try {
    const { firstName, lastName, email, reason, message } = req.body || {};

    // 1. Validation
    const trimmedFirstName = typeof firstName === 'string' ? firstName.trim() : '';
    const trimmedLastName = typeof lastName === 'string' ? lastName.trim() : '';
    const trimmedEmail = typeof email === 'string' ? email.trim() : '';
    const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
    const trimmedMessage = typeof message === 'string' ? message.trim() : '';

    if (!trimmedFirstName) {
      return res.status(400).json({ error: 'First Name is required.' });
    }
    if (!trimmedLastName) {
      return res.status(400).json({ error: 'Last Name is required.' });
    }
    if (!trimmedEmail) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!trimmedReason || !VALID_REASONS.includes(trimmedReason)) {
      return res.status(400).json({
        error: `Reason must be one of: ${VALID_REASONS.join(', ')}.`
      });
    }
    if (!trimmedMessage) {
      return res.status(400).json({ error: 'Message content cannot be empty.' });
    }

    // 2. Read existing data
    let submissions = [];
    try {
      submissions = await readContactSubmissions();
    } catch (readErr) {
      console.error('Storage read failure:', readErr);
      return res.status(500).json({ error: 'Storage failure: unable to load messages.' });
    }

    // 3. Create new record
    const newRecord = {
      id: crypto.randomUUID(),
      firstName: trimmedFirstName,
      lastName: trimmedLastName,
      email: trimmedEmail,
      reason: trimmedReason,
      message: trimmedMessage,
      submittedAt: new Date().toISOString(),
      replied: false,
      repliedAt: null
    };

    // 4. Append and write back to App Storage
    submissions.push(newRecord);

    try {
      await writeContactSubmissions(submissions);
    } catch (writeErr) {
      console.error('Storage write failure:', writeErr);
      return res.status(500).json({ error: 'Storage failure: unable to persist contact record.' });
    }

    // 5. Return HTTP 201 with saved record
    return res.status(201).json({
      success: true,
      message: 'Thank you! Your message has been received.',
      record: newRecord
    });
  } catch (err) {
    console.error('Unexpected error in POST /api/contact:', err);
    return res.status(500).json({ error: 'Internal server error while processing contact form.' });
  }
});

/**
 * GET /api/contact
 * Admin endpoint to list all contact submissions
 */
app.get('/api/contact', async (req, res) => {
  try {
    const submissions = await readContactSubmissions();
    // Return newest first
    const sorted = [...submissions].reverse();
    return res.json({
      success: true,
      count: submissions.length,
      submissions: sorted
    });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    return res.status(500).json({ error: 'Failed to retrieve contact submissions.' });
  }
});

/**
 * PATCH /api/contact/:id/reply
 * Admin endpoint to toggle or mark a submission as replied
 */
app.patch('/api/contact/:id/reply', async (req, res) => {
  try {
    const { id } = req.params;
    const submissions = await readContactSubmissions();
    const index = submissions.findIndex(s => s.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    const currentStatus = submissions[index].replied;
    submissions[index].replied = !currentStatus;
    submissions[index].repliedAt = !currentStatus ? new Date().toISOString() : null;

    await writeContactSubmissions(submissions);

    return res.json({
      success: true,
      record: submissions[index]
    });
  } catch (err) {
    console.error('Error updating reply status:', err);
    return res.status(500).json({ error: 'Failed to update reply status.' });
  }
});

/**
 * DELETE /api/contact/:id
 * Admin endpoint to remove a submission
 */
app.delete('/api/contact/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let submissions = await readContactSubmissions();
    const originalLength = submissions.length;
    submissions = submissions.filter(s => s.id !== id);

    if (submissions.length === originalLength) {
      return res.status(404).json({ error: 'Message not found.' });
    }

    await writeContactSubmissions(submissions);

    return res.json({
      success: true,
      message: 'Message deleted successfully.'
    });
  } catch (err) {
    console.error('Error deleting contact:', err);
    return res.status(500).json({ error: 'Failed to delete message.' });
  }
});

/**
 * POST /api/upload-profile
 * Saves student profile photo permanently to disk
 */
app.post('/api/upload-profile', async (req, res) => {
  try {
    const { imageBase64 } = req.body || {};
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing imageBase64 data.' });
    }

    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const assetsImgDir = path.join(__dirname, 'assets', 'images');
    await fs.mkdir(assetsImgDir, { recursive: true });

    const targetFile = path.join(assetsImgDir, 'student-profile.jpg');
    await fs.writeFile(targetFile, buffer);

    // Also keep convenient aliases
    await fs.writeFile(path.join(assetsImgDir, 'photo.2.jpg'), buffer);
    await fs.writeFile(path.join(__dirname, 'photo.2.jpg'), buffer);

    return res.status(200).json({
      success: true,
      message: 'Profile photo uploaded and saved successfully.',
      url: `assets/images/student-profile.jpg?t=${Date.now()}`
    });
  } catch (err) {
    console.error('Error saving profile image:', err);
    return res.status(500).json({ error: 'Failed to save profile image.' });
  }
});

// --------------------------------------------------------------------------
// CHOICE PAGES REDIRECTS / COMPATIBILITY
// --------------------------------------------------------------------------
// Redirect original choice1.html & choice2.html to their renamed descriptive filenames
app.get('/choice1.html', (req, res) => res.redirect(301, '/interests.html'));
app.get('/choice1', (req, res) => res.redirect(301, '/interests.html'));
app.get('/choice2.html', (req, res) => res.redirect(301, '/projects.html'));
app.get('/choice2', (req, res) => res.redirect(301, '/projects.html'));

// Static files (HTML, CSS, JS, Assets)
app.use(express.static(__dirname));

// Fallback to index.html for root if needed
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(port, () => {
  console.log(`Portfolio server for Alex Mckee running on http://localhost:${port}`);
  console.log(`Serving pages from: ${__dirname}`);
  console.log(`Persistent storage path: ${LOCAL_STORAGE_PATH}`);
});
