const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const CDP = require('chrome-remote-interface');
class DiscordStreamServer {
  constructor(port = 3333) {
    this.port = port;
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocket.Server({ server: this.server });
    this.clients = new Set();
    this.lastDiscordError = 0;

    this.setupExpress();
    this.setupWebSocket();
  }

  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());

    this.app.use(express.static(__dirname));

    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    this.app.get('/api/discord/status', async (req, res) => {
      try {
        await this.executeInDiscord('typeof DiscordStreamDeck !== "undefined"');
        res.json({
          status: 'connected',
          message: 'Discord is connected and script is injected',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(503).json({
          status: 'disconnected',
          message: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.app.get('/api/streams', async (req, res) => {
      try {
        const result = await this.executeInDiscord('DiscordStreamDeck.getStatus()');
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/streams/refresh', async (req, res) => {
      try {
        await this.executeInDiscord('DiscordStreamDeck.refreshStreams()');
        const result = await this.executeInDiscord('DiscordStreamDeck.getStatus()');
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/streams/switch-by-id/:streamId', async (req, res) => {
      try {
        const { streamId } = req.params;
        const result = await this.executeInDiscord(
          `DiscordStreamDeck.switchToStreamById("${streamId}")`
        );
        res.json({ success: result, streamId });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/streams/switch-by-index/:index', async (req, res) => {
      try {
        const index = parseInt(req.params.index, 10);
        const result = await this.executeInDiscord(
          `DiscordStreamDeck.switchToStreamByIndex(${index})`
        );
        res.json({ success: result, index });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/streams/next', async (req, res) => {
      try {
        const result = await this.executeInDiscord('DiscordStreamDeck.switchToNextStream()');
        res.json({ success: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    this.app.post('/api/streams/previous', async (req, res) => {
      try {
        const result = await this.executeInDiscord('DiscordStreamDeck.switchToPreviousStream()');
        res.json({ success: result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/stream-deck/button/:buttonNumber', async (req, res) => {
      try {
        const buttonNumber = parseInt(req.params.buttonNumber, 10);
        if (buttonNumber < 1 || buttonNumber > 32) {
          return res.status(400).json({ error: 'Button number must be between 1 and 32' });
        }
        const streamIndex = buttonNumber - 1;
        const result = await this.executeInDiscord(
          `DiscordStreamDeck.switchToStreamByIndex(${streamIndex})`
        );
        res.json({ success: result, buttonNumber, streamIndex });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          const response = await this.handleWebSocketMessage(data);
          ws.send(JSON.stringify(response));
        } catch (error) {
          ws.send(JSON.stringify({ error: error.message }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      this.sendStreamStatus().catch((err) => {
        console.warn('Failed to send initial status:', err.message);
      });
    });
  }

  async handleWebSocketMessage(data) {
    const { command, params = {} } = data;
    switch (command) {
      case 'get_streams':
        return await this.executeInDiscord('DiscordStreamDeck.getStatus()');
      case 'refresh':
        await this.executeInDiscord('DiscordStreamDeck.refreshStreams()');
        return await this.executeInDiscord('DiscordStreamDeck.getStatus()');
      case 'switch_by_id': {
        const success = await this.executeInDiscord(
          `DiscordStreamDeck.switchToStreamById("${params.streamId}")`
        );
        return { success, streamId: params.streamId };
      }
      case 'switch_by_index': {
        const success = await this.executeInDiscord(
          `DiscordStreamDeck.switchToStreamByIndex(${params.index})`
        );
        return { success, index: params.index };
      }
      case 'next': {
        const success = await this.executeInDiscord('DiscordStreamDeck.switchToNextStream()');
        return { success };
      }
      case 'previous': {
        const success = await this.executeInDiscord('DiscordStreamDeck.switchToPreviousStream()');
        return { success };
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async executeInDiscord(code) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Discord connection timeout – ensure Discord is launched with --remote-debugging-port=9222'));
      }, 5000);

      CDP({ port: 9222 }, async (client) => {
        try {
          clearTimeout(timeout);
          const { Runtime } = client;
          await Runtime.enable();

          const check = await Runtime.evaluate({
            expression: 'typeof DiscordStreamDeck !== "undefined"',
            returnByValue: true,
          });

          if (!check.result.value) {
            throw new Error('DiscordStreamDeck script not injected – please run stream_deck_integration.js in Discord console');
          }

          const result = await Runtime.evaluate({
            expression: code,
            returnByValue: true,
          });

          if (result.exceptionDetails) {
            throw new Error(`Discord script error: ${result.exceptionDetails.text}`);
          }
          resolve(result.result.value);
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        } finally {
          try {
            client.close();
          } catch (e) {}
        }
      }).on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Chrome Remote Debugging connection failed: ${err.message}. Ensure Discord is running with --remote-debugging-port=9222`));
      });
    });
  }

  async sendStreamStatus() {
    try {
      const status = await this.executeInDiscord('DiscordStreamDeck.getStatus()');
      const message = JSON.stringify({
        type: 'stream_status',
        data: status,
        timestamp: new Date().toISOString(),
      });
      this.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    } catch (err) {
      if (!this.lastDiscordError || Date.now() - this.lastDiscordError > 60000) {
        this.lastDiscordError = Date.now();
      }
      const errorMessage = JSON.stringify({
        type: 'discord_error',
        error: err.message,
        timestamp: new Date().toISOString(),
      });
      this.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(errorMessage);
        }
      });
    }
  }

  start() {
    this.server.listen(this.port, () => {
      console.log(`🎮 Discord Stream Server running at http://localhost:${this.port}`);
    });

    setInterval(() => {
      if (this.clients.size > 0) {
        this.sendStreamStatus().catch(() => {});
      }
    }, 10000);
  }
}

if (require.main === module) {
  const server = new DiscordStreamServer(parseInt(process.env.PORT, 10) || 3333);
  server.start();
}

module.exports = DiscordStreamServer;