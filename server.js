const express = require('express');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'tasks.json');
const CONFIG_FILE = path.join(__dirname, 'data', 'config.json');
const NTFY_TOPIC = 'REPLACE_WITH_NTFY_TOPIC';

// Ensure data dir exists
if (!fs.existsSync(path.dirname(DATA_FILE))) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
}

// Helpers
const loadTasks = () => {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
};

const saveTasks = (tasks) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2));
};

const loadConfig = () => {
  if (!fs.existsSync(CONFIG_FILE)) return { ntfy_topic: NTFY_TOPIC };
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
};

const saveConfig = (config) => {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
};

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Task Routes ---
app.get('/api/tasks', (req, res) => res.json(loadTasks()));

app.post('/api/tasks', (req, res) => {
  const tasks = loadTasks();
  const task = {
    id: Date.now().toString(),
    title: req.body.title,
    priority: req.body.priority || 'medium',
    completed: false,
    reminder: req.body.reminder || null, // ISO string or null
    reminderFired: false,
    createdAt: new Date().toISOString()
  };
  tasks.push(task);
  saveTasks(tasks);
  res.json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const tasks = loadTasks();
  const idx = tasks.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  tasks[idx] = { ...tasks[idx], ...req.body };
  saveTasks(tasks);
  res.json(tasks[idx]);
});

app.delete('/api/tasks/:id', (req, res) => {
  let tasks = loadTasks();
  tasks = tasks.filter(t => t.id !== req.params.id);
  saveTasks(tasks);
  res.json({ ok: true });
});

// --- Config Routes ---
app.get('/api/config', (req, res) => res.json(loadConfig()));

app.post('/api/config', (req, res) => {
  const config = { ...loadConfig(), ...req.body };
  saveConfig(config);
  res.json(config);
});

// --- Notification Helper ---
const sendNtfy = (topic, msg, title = null, priority = null) => {
  try {
    let cmd = `curl -s`;
    if (title) cmd += ` -H "Title: ${title.replace(/"/g, '\\"')}"`;
    if (priority) cmd += ` -H "Priority: ${priority}"`;
    cmd += ` -d "${msg.replace(/"/g, '\\"')}" ntfy.sh/${topic}`;
    execSync(cmd);
    console.log(`[ntfy] Sent: ${msg}`);
  } catch (e) {
    console.error(`[ntfy] Failed: ${e.message}`);
  }
};

// --- Scheduled Reminder Checker (every 60 seconds) ---
const checkReminders = () => {
  const tasks = loadTasks();
  const config = loadConfig();
  const topic = config.ntfy_topic || NTFY_TOPIC;
  const now = new Date();
  let changed = false;

  tasks.forEach(task => {
    if (task.reminder && !task.reminderFired && !task.completed) {
      if (new Date(task.reminder) <= now) {
        sendNtfy(topic, `${task.title}`, `⏰ Reminder [${task.priority}]`, task.priority === 'high' ? 'high' : 'default');
        task.reminderFired = true;
        changed = true;
      }
    }
  });

  if (changed) saveTasks(tasks);
};

// --- Daily Digest at 6:00 AM and 6:00 PM ---
const checkDailyDigest = () => {
  const now = new Date();
  const h = now.getHours(), m = now.getMinutes();
  if ((h === 6 || h === 18) && m === 0) {
    const tasks = loadTasks();
    const config = loadConfig();
    const topic = config.ntfy_topic || NTFY_TOPIC;
    const active = tasks.filter(t => !t.completed);
    if (!active.length) {
      sendNtfy(topic, 'No pending tasks. Great job! 🎉', `${h === 6 ? '🌅 Morning' : '🌆 Evening'} Digest`);
      return;
    }
    const lines = active
      .sort((a, b) => ({high:0,medium:1,low:2}[a.priority] - ({high:0,medium:1,low:2}[b.priority])))
      .map(t => `[${t.priority.toUpperCase()}] ${t.title}`)
      .join('\n');
    sendNtfy(topic, lines, `${h === 6 ? '🌅 Morning' : '🌆 Evening'} Digest — ${active.length} task${active.length > 1 ? 's' : ''}`);
  }
};

// --- Hourly High Priority Nudge (fires on the hour) ---
const checkHighPriority = () => {
  const now = new Date();
  if (now.getMinutes() !== 0) return;
  const tasks = loadTasks();
  const config = loadConfig();
  const topic = config.ntfy_topic || NTFY_TOPIC;
  const high = tasks.filter(t => !t.completed && t.priority === 'high');
  if (!high.length) return;
  const lines = high.map(t => `• ${t.title}`).join('\n');
  sendNtfy(topic, lines, `🔴 ${high.length} High Priority Task${high.length > 1 ? 's' : ''} Pending`, 'high');
};

// --- Main tick (every 60 seconds) ---
const tick = () => {
  checkReminders();
  checkDailyDigest();
  checkHighPriority();
};

setInterval(tick, 60 * 1000);
tick(); // run once on startup

app.listen(PORT, () => console.log(`Todo app running on port ${PORT}`));
