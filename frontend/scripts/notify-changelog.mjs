#!/usr/bin/env node
/**
 * Posts the latest changelog entry to Discord (#signal).
 * Webhook (discord-webhook.local.json) or Bot token (discord-bot.local.json).
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_TEXT_CHANNEL_ID = '1512122313670262985';
const DEFAULT_GUILD_ID = '1512107730427711498';
const SITE_URL = 'https://frontend-henna-tau-19.vercel.app';
const UPDATES_URL = `${SITE_URL}/updates`;
const BRAND_ICON = `${SITE_URL}/brand/image/logo/brand.png`;
const EMBED_COLOR = 0x14b8a6;

const LABEL_ICON = {
  Новое: '✨',
  Улучшено: '⬆️',
  Исправлено: '🔧',
};

function exitLater(code) {
  setTimeout(() => process.exit(code), 50);
}

function isVercelBuild() {
  return process.env.VERCEL === '1';
}

function finish(code) {
  if (code !== 0 && isVercelBuild()) {
    console.warn('Discord notify failed; Vercel build continues.');
    exitLater(0);
    return;
  }
  exitLater(code);
}

/** Пропуск при локальной сборке; на Vercel — только production. */
function shouldSkipAutoNotify() {
  if (process.env.FORCE_CHANGELOG_NOTIFY === '1') return false;
  if (process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true') return false;
  if (process.env.VERCEL === '1') {
    if (process.env.VERCEL_ENV !== 'production') {
      console.log(`Пропуск Discord: Vercel env=${process.env.VERCEL_ENV || '?'} (не production).`);
      return true;
    }
    return false;
  }
  return false;
}

function loadWebhookConfig() {
  if (process.env.DISCORD_CHANGELOG_WEBHOOK_URL?.trim()) {
    return {
      url: process.env.DISCORD_CHANGELOG_WEBHOOK_URL.trim(),
      source: 'DISCORD_CHANGELOG_WEBHOOK_URL (env)',
      channel_id: process.env.DISCORD_CHANGELOG_CHANNEL_ID?.trim() || DEFAULT_TEXT_CHANNEL_ID,
      guild_id: process.env.DISCORD_GUILD_ID?.trim() || DEFAULT_GUILD_ID,
    };
  }
  const localPath = join(root, 'discord-webhook.local.json');
  if (!existsSync(localPath)) return null;
  const cfg = JSON.parse(readFileSync(localPath, 'utf8'));
  if (!cfg.url) return null;
  return { url: cfg.url, source: 'discord-webhook.local.json', ...cfg };
}

function loadBotConfig() {
  if (process.env.DISCORD_BOT_TOKEN?.trim()) {
    return {
      token: process.env.DISCORD_BOT_TOKEN.trim(),
      channel_id: process.env.DISCORD_CHANGELOG_CHANNEL_ID?.trim() || DEFAULT_TEXT_CHANNEL_ID,
      guild_id: process.env.DISCORD_GUILD_ID?.trim() || DEFAULT_GUILD_ID,
      source: 'DISCORD_BOT_TOKEN (env)',
    };
  }
  const localPath = join(root, 'discord-bot.local.json');
  if (!existsSync(localPath)) return null;
  const cfg = JSON.parse(readFileSync(localPath, 'utf8'));
  if (!cfg.token) return null;
  return {
    token: cfg.token,
    channel_id: cfg.channel_id || DEFAULT_TEXT_CHANNEL_ID,
    guild_id: cfg.guild_id || DEFAULT_GUILD_ID,
    source: 'discord-bot.local.json',
  };
}

function loadChangelog() {
  const path = join(root, 'src/data/changelog.json');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const entry = data.entries?.[0];
  if (!entry) throw new Error('changelog.json has no entries');
  return entry;
}

/** Bare URLs break Discord layout (red bar, link preview). */
function formatChangeText(text) {
  const raw = (text || '—').trim();
  return raw.replace(/https?:\/\/[^\s<>]+/g, (url) => `[открыть](${url})`);
}

function buildPayload(entry) {
  const changes = (entry.changes ?? []).slice(0, 8);
  const changeBlock = changes
    .map((c) => {
      const icon = LABEL_ICON[c.label] || '•';
      const label = c.label || 'Изменение';
      return `${icon} **${label}** — ${formatChangeText(c.text)}`;
    })
    .join('\n');

  const descriptionParts = [
    entry.summary?.trim(),
    changeBlock || null,
    `[Подробнее на сайте](${UPDATES_URL})`,
  ].filter(Boolean);

  const embed = {
    author: {
      name: 'Nexus · релиз',
      icon_url: BRAND_ICON,
    },
    title: `v${entry.version} — ${entry.title}`,
    description: descriptionParts.join('\n\n').slice(0, 4096),
    color: EMBED_COLOR,
    footer: { text: `nexus.ai · ${entry.date}` },
    timestamp: new Date().toISOString(),
  };

  // Не ставить flags: 4 (SUPPRESS_EMBEDS) — Discord скрывает ВСЕ embed, остаётся пустое сообщение.
  return {
    username: 'Nexus Signal',
    avatar_url: BRAND_ICON,
    embeds: [embed],
  };
}

function printSuccess(entry, message, via, extra = {}) {
  console.log(`Changelog v${entry.version} sent to Discord (${via}).`);
  if (extra.source) console.log(`Source: ${extra.source}`);
  if (message?.channel_id) {
    const guildId = extra.guild_id || message.guild_id || DEFAULT_GUILD_ID;
    console.log(`Channel ID: ${message.channel_id}`);
    console.log(
      `Open message: https://discord.com/channels/${guildId}/${message.channel_id}/${message.id}`
    );
  }
}

async function postViaWebhook(cfg, payload, expectedChannelId) {
  const webhookBase = cfg.url.replace(/\?.*$/, '');
  const metaRes = await fetch(webhookBase);
  if (!metaRes.ok) {
    throw new Error(`Cannot read webhook: ${metaRes.status} ${await metaRes.text()}`);
  }
  const meta = await metaRes.json();
  if (meta.channel_id !== expectedChannelId) {
    return {
      ok: false,
      reason: 'wrong_channel',
      actual: meta.channel_id,
      expected: expectedChannelId,
    };
  }

  const res = await fetch(`${webhookBase}?wait=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Webhook POST failed: ${res.status} ${text}`);
  let message = null;
  try {
    message = JSON.parse(text);
  } catch {
    /* empty */
  }
  if (!message?.embeds?.length) {
    throw new Error('Discord accepted message but embed is missing (check payload)');
  }
  return { ok: true, message, guild_id: cfg.guild_id || meta.guild_id };
}

async function postViaBot(botCfg, payload) {
  const channelId = botCfg.channel_id || DEFAULT_TEXT_CHANNEL_ID;
  const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bot ${botCfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Bot POST failed: ${res.status} ${text}`);
  }
  return { ok: true, message: JSON.parse(text), guild_id: botCfg.guild_id };
}

async function run() {
  if (shouldSkipAutoNotify()) {
    finish(0);
    return;
  }

  const entry = loadChangelog();
  const payload = buildPayload(entry);
  const expectedChannelId =
    loadWebhookConfig()?.channel_id || loadBotConfig()?.channel_id || DEFAULT_TEXT_CHANNEL_ID;

  const webhookCfg = loadWebhookConfig();
  const botCfg = loadBotConfig();

  if (webhookCfg) {
    try {
      const result = await postViaWebhook(webhookCfg, payload, expectedChannelId);
      if (result.ok) {
        printSuccess(entry, result.message, 'webhook', {
          source: webhookCfg.source,
          guild_id: result.guild_id,
        });
      finish(0);
      return;
    }
    console.warn(
        `Webhook на канале ${result.actual}, нужен (${result.expected}). Пробую бота…`
      );
    } catch (e) {
      console.warn(`Webhook: ${e.message}. Пробую бота…`);
    }
  }

  if (botCfg) {
    try {
      const result = await postViaBot(botCfg, payload);
      printSuccess(entry, result.message, 'bot', {
        source: botCfg.source,
        guild_id: result.guild_id,
      });
    finish(0);
    return;
  } catch (e) {
    console.error(`Bot: ${e.message}`);
    finish(1);
    return;
  }
}

  console.error(`Не удалось отправить ченджлог (#signal, ${expectedChannelId}).`);
  finish(1);
}

run().catch((e) => {
  console.error(e);
  finish(1);
});
