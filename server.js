const express = require('express');
const cors = require('cors');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const CDP = require('chrome-remote-interface');

/**
 * DiscordStreamServer exposes a tiny HTTP and WebSocket API for controlling
 * active Discord streams through Chrome's remote debugging protocol.  The
 * implementation is loosely based on the reference implementation contained
 * in the upstream `discord_stream_switcher` project, but is refactored to
 * live inside a self‑contained folder.  The server exposes REST endpoints
 * for reading available streams, refreshing the internal cache, and
 * switching to a particular stream by either index or identifier.  A
 * companion WebSocket is used to broadcast stream updates back to the UI.
 */
class DiscordStreamServer {
  /**
   * Create a new server.
   *
   * @param {number} port The port to listen on.
   */
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

  /**
   * Configure the Express application.  CORS is enabled for simplicity and the
   * `discord_web_app` folder is served statically so that the integration
   * script and index.html can be loaded without any additional routing.
   */
  setupExpress() {
    this.app.use(cors());
    this.app.use(express.json());

    // Serve static files from the current directory.  This includes
    // index.html and script_integration.js.
    this.app.use(express.static(__dirname));

    // Health check endpoint used by the dashboard to verify that the server
    // is up and running.
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Check whether the Discord integration is injected.  This sends a
    // single evaluation to the Discord tab to see if the global object exists.
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

    // Return the current list of streams and metadata.  The return value is
    // whatever the Discord script provides from getStatus().
    this.app.get('/api/streams', async (req, res) => {
      try {
        const result = await this.executeInDiscord('DiscordStreamDeck.getStatus()');
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Force a refresh of the internal stream list.  Useful when streams come
    // and go.  After refreshing we immediately query the status again.
    this.app.post('/api/streams/refresh', async (req, res) => {
      try {
        await this.executeInDiscord('DiscordStreamDeck.refreshStreams()');
        const result = await this.executeInDiscord('DiscordStreamDeck.getStatus()');
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    // Switch to a stream by its unique identifier.  The `:streamId` portion of
    // the URL is encoded into a runtime evaluation call in the Discord tab.
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

    // Switch to a stream based on its numeric index in the current list (0‑based).
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

    // Move to the next or previous stream.  These endpoints cycle through the
    // current list and update the internal state in Discord.  The next and
    // previous commands wrap around automatically.
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

    // Generic route to support Stream Deck buttons (1‑32).  The mapping here
    // translates button 1 to index 0 and so on.  Requests outside of the
    // valid range return a 400.
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

  /**
   * Configure the WebSocket server.  Each connected client receives periodic
   * status updates so the UI can stay in sync with the stream list.  When a
   * client sends a command over the socket we dispatch it to the Discord tab
   * through the evaluate helper.
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('Stream Deck client connected');
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
        console.log('Stream Deck client disconnected');
        this.clients.delete(ws);
      });

      // Immediately send status after connecting
      this.sendStreamStatus().catch((err) => {
        console.warn('Failed to send initial status:', err.message);
      });
    });
  }

  /**
   * Dispatch commands sent over the WebSocket to the appropriate Discord
   * evaluation call.  The command names mirror the REST endpoints for
   * consistency.
   *
   * @param {object} data The message payload received from the client
   * @returns {object} The response object sent back to the client
   */
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

  /**
   * Evaluate a snippet of JavaScript in the Discord tab via Chrome Remote
   * Interface.  This function handles connection management, timeouts and
   * cleanup.  On success it resolves with the value of the evaluated
   * expression.  On failure it rejects with an Error.
   *
   * @param {string} code The JavaScript to evaluate in the Discord tab
   */
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

  /**
   * Broadcast the current stream status to all connected WebSocket clients.
   * Any errors encountered while querying Discord are logged and forwarded
   * to the clients as special `discord_error` messages so the UI can
   * present useful feedback.
   */
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
      // Rate limit repeated error messages
      if (!this.lastDiscordError || Date.now() - this.lastDiscordError > 60000) {
        console.warn('⚠️  Discord not ready:', err.message);
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

  /**
   * Start listening on the configured port and schedule periodic status
   * broadcasts.  When started directly (not imported) this method runs
   * automatically.
   */
  start() {
    this.server.listen(this.port, () => {
      console.log(`🎮 Discord Stream Server running at http://localhost:${this.port}`);
      console.log(`🔧 Chrome remote debugging expected on port 9222`);
      console.log('');
      console.log('Endpoints:');
      console.log('  GET  /api/streams             – list streams');
      console.log('  POST /api/streams/refresh     – refresh streams');
      console.log('  POST /api/streams/switch-by-id/:id');
      console.log('  POST /api/streams/switch-by-index/:idx');
      console.log('  POST /api/streams/next');
      console.log('  POST /api/streams/previous');
      console.log('');
    });

    setInterval(() => {
      if (this.clients.size > 0) {
        this.sendStreamStatus().catch(() => {});
      }
    }, 10000);
  }
}

// Only start automatically when run via `node server.js`.
if (require.main === module) {
  const server = new DiscordStreamServer(parseInt(process.env.PORT, 10) || 3333);
  server.start();
}

module.exports = DiscordStreamServer;