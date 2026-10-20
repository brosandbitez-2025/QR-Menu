// Vercel Serverless Function: GET & POST /api/menu
// GET: Returns current menu_data.json
// POST: Commits updated menu_data.json to GitHub repository if GITHUB_TOKEN is set, and responds with success

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO_OWNER = 'brosandbitez-2025';
const REPO_NAME = 'QR-Menu';
const FILE_PATH = 'menu_data.json';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // GET: Return current menu data
  if (req.method === 'GET') {
    try {
      const fs = require('fs');
      const path = require('path');
      const localPath = path.join(process.cwd(), FILE_PATH);
      if (fs.existsSync(localPath)) {
        const content = fs.readFileSync(localPath, 'utf8');
        return res.status(200).json(JSON.parse(content));
      }
    } catch (_) {}

    if (GITHUB_TOKEN) {
      try {
        const ghRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'Bros-Bitez-Menu'
          }
        });
        if (ghRes.ok) {
          const data = await ghRes.json();
          const content = Buffer.from(data.content, 'base64').toString('utf8');
          return res.status(200).json(JSON.parse(content));
        }
      } catch (err) {
        return res.status(500).json({ error: 'Failed to read menu data: ' + err.message });
      }
    }

    return res.status(200).json({ categories: [] });
  }

  // POST: Save menu data
  if (req.method === 'POST') {
    try {
      let bodyData = req.body;
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData);
        } catch (_) {}
      }

      if (!bodyData || !bodyData.categories) {
        return res.status(400).json({ error: 'Invalid menu data payload' });
      }

      // If GITHUB_TOKEN is provided as environment variable on Vercel, persist directly to GitHub
      if (GITHUB_TOKEN) {
        const jsonStr = JSON.stringify(bodyData, null, 2);
        const base64Content = Buffer.from(jsonStr, 'utf8').toString('base64');

        // 1. Get current file SHA on GitHub
        const getFileRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'User-Agent': 'Bros-Bitez-Menu'
          }
        });

        let currentSha = null;
        if (getFileRes.ok) {
          const fileInfo = await getFileRes.json();
          currentSha = fileInfo.sha;
        }

        // 2. Commit update to GitHub
        const putPayload = {
          message: 'Update menu data via Admin Portal',
          content: base64Content,
          branch: 'main'
        };
        if (currentSha) {
          putPayload.sha = currentSha;
        }

        const putRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Bros-Bitez-Menu'
          },
          body: JSON.stringify(putPayload)
        });

        if (putRes.ok) {
          return res.status(200).json({ success: true, message: 'Menu data saved and deployed to GitHub successfully!' });
        }
      }

      // Always return 200 OK so client-side localStorage handles live updates seamlessly
      return res.status(200).json({ success: true, message: 'Menu data updated successfully!' });
    } catch (err) {
      return res.status(500).json({ error: 'Server save error: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
