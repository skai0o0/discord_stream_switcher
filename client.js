/**
 * Client side controller for the Discord Stream Switcher dashboard.  This
 * script connects to the back‑end via both HTTP and WebSocket in order to
 * discover active streams and issue commands to Discord.  The UI is kept
 * deliberately lightweight, focusing on responsiveness rather than
 * animations and decoration.  A log pane records recent actions for
 * debugging.
 */
class StreamSwitcher {
  constructor() {
    // Assume the API runs on the same host as the page.  If you serve the
    // dashboard from a different origin you will need to update these
    // constants accordingly.
    this.serverUrl = 'http://localhost:3333';
    this.wsUrl = 'ws://localhost:3333';

    this.ws = null;
    this.reconnectInterval = null;
    this.streams = [];
    this.currentIndex = 0;

    this.init();
  }

  /**
   * Initialise the controller by connecting to the WebSocket and doing an
   * initial health check.  We also schedule a periodic refresh of the
   * stream list every 30 seconds.
   */
  init() {
    this.log('Initialising...', 'info');
    this.connectWebSocket();
    this.testServerConnection();
    // Periodic refresh every 30s
    setInterval(() => this.refreshStreams(), 30000);
  }

  /**
   * Connect to the back‑end WebSocket and set up handlers for status
   * messages.  When the connection drops we schedule a reconnect every 5
   * seconds.
   */
  connectWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        this.log('WebSocket connected', 'success');
        this.updateStatus('server', 'online', 'Connected');
        this.clearReconnectInterval();
      };
      this.ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data.type === 'stream_status') {
            this.updateStreamData(data.data);
          } else if (data.type === 'discord_error') {
            this.log(`Discord error: ${data.error}`, 'error');
            this.updateStatus('discord', 'offline', 'Not Ready');
          }
        } catch (err) {
          this.log('Failed to parse websocket message: ' + err.message, 'error');
        }
      };
      this.ws.onclose = () => {
        this.log('WebSocket disconnected', 'error');
        this.updateStatus('server', 'offline', 'Disconnected');
        this.scheduleReconnect();
      };
      this.ws.onerror = (err) => {
        this.log('WebSocket error: ' + err.message, 'error');
        this.updateStatus('server', 'offline', 'Error');
      };
    } catch (err) {
      this.log('Unable to connect WebSocket: ' + err.message, 'error');
      this.updateStatus('server', 'offline', 'Failed');
      this.scheduleReconnect();
    }
  }

  /** Schedule reconnection attempts every 5 seconds. */
  scheduleReconnect() {
    if (this.reconnectInterval) return;
    this.reconnectInterval = setInterval(() => {
      this.log('Attempting to reconnect WebSocket...', 'info');
      this.connectWebSocket();
    }, 5000);
  }

  /** Clear any active reconnect timer. */
  clearReconnectInterval() {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }
  }

  /**
   * Low level API call helper.  Wraps fetch and adds JSON parsing and
   * error handling.
   * @param {string} endpoint REST endpoint starting with '/'
   * @param {string} method HTTP method (GET or POST)
   * @param {object|null} data POST body
   */
  async apiCall(endpoint, method = 'GET', data = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) options.body = JSON.stringify(data);
    const res = await fetch(this.serverUrl + endpoint, options);
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || 'API call failed');
    }
    return json;
  }

  /** Test both the server health and the Discord connection. */
  async testServerConnection() {
    try {
      await this.apiCall('/health');
      this.updateStatus('server', 'online', 'Connected');
      this.log('Server OK', 'success');
      try {
        await this.apiCall('/api/discord/status');
        this.updateStatus('discord', 'online', 'Connected');
        this.log('Discord OK', 'success');
        await this.refreshStreams();
      } catch (discErr) {
        this.updateStatus('discord', 'offline', 'Not Ready');
        this.log('Discord not ready: ' + discErr.message, 'error');
      }
    } catch (err) {
      this.updateStatus('server', 'offline', 'Offline');
      this.log('Server not available: ' + err.message, 'error');
    }
  }

  /** Force a refresh of the stream list via the API. */
  async refreshStreams() {
    try {
      const result = await this.apiCall('/api/streams/refresh', 'POST');
      this.updateStreamData(result);
      this.log(`Found ${this.streams.length} streams`, 'success');
    } catch (err) {
      this.log('Failed to refresh streams: ' + err.message, 'error');
    }
  }

  /** Switch to a particular stream by index. */
  async switchToStream(index) {
    try {
      const result = await this.apiCall(`/api/streams/switch-by-index/${index}`, 'POST');
      if (result.success) {
        this.currentIndex = index;
        this.updateStreamGrid();
        this.log(`Switched to stream ${index + 1}`, 'success');
      } else {
        this.log('Failed to switch stream', 'error');
      }
    } catch (err) {
      this.log('Error switching stream: ' + err.message, 'error');
    }
  }

  /** Move forward/backward through the stream list. */
  async nextStream() {
    try {
      const result = await this.apiCall('/api/streams/next', 'POST');
      if (result.success) {
        this.log('Next stream', 'success');
        await this.refreshStreams();
      }
    } catch (err) {
      this.log('Error switching to next: ' + err.message, 'error');
    }
  }
  async previousStream() {
    try {
      const result = await this.apiCall('/api/streams/previous', 'POST');
      if (result.success) {
        this.log('Previous stream', 'success');
        await this.refreshStreams();
      }
    } catch (err) {
      this.log('Error switching to previous: ' + err.message, 'error');
    }
  }

  /** Update internal stream list and UI. */
  updateStreamData(data) {
    this.streams = data.streams || [];
    this.currentIndex = data.currentIndex || 0;
    this.updateStreamGrid();
    // Update Discord status
    if (this.streams.length > 0) {
      this.updateStatus('discord', 'online', 'Connected');
    } else {
      this.updateStatus('discord', 'warning', 'No streams');
    }
  }

  /** Render the stream grid. */
  updateStreamGrid() {
    const grid = document.getElementById('streamGrid');
    grid.innerHTML = '';
    if (this.streams.length === 0) {
      grid.textContent = 'No streams detected – ensure Discord is in grid view and multistream is enabled.';
      return;
    }
    this.streams.forEach((stream, idx) => {
      const btn = document.createElement('button');
      btn.className = 'stream-button' + (idx === this.currentIndex ? ' active' : '');
      btn.onclick = () => this.switchToStream(idx);
      const streamId = typeof stream === 'string' ? stream : stream.id;
      const name = typeof stream === 'object' && stream.name ? stream.name : `Stream ${idx + 1}`;
      btn.textContent = name;
      const small = document.createElement('small');
      if (streamId) {
        small.textContent = streamId.substring(0, 8) + '...' + streamId.substring(streamId.length - 4);
      }
      btn.appendChild(small);
      // Add F# label for first 12 streams
      if (idx < 12) {
        const label = document.createElement('div');
        label.style.cssText = 'position:absolute;top:4px;right:4px;background:rgba(255,255,255,0.2);padding:2px 4px;border-radius:3px;font-size:10px;font-weight:bold;';
        label.textContent = 'F' + (idx + 1);
        btn.appendChild(label);
      }
      grid.appendChild(btn);
    });
  }

  /** Update the UI indicators for server and Discord status. */
  updateStatus(type, status, text) {
    const container = document.getElementById(type + 'Status');
    const textEl = document.getElementById(type + 'StatusText');
    if (!container || !textEl) return;
    // Remove all status classes
    container.querySelector('.dot').className = 'dot ' + status;
    textEl.textContent = text;
  }

  /** Append a message to the log pane. */
  log(message, type = 'info') {
    const logEl = document.getElementById('logEntries');
    const entry = document.createElement('div');
    entry.className = 'log-entry ' + type;
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="timestamp">[${time}]</span> ${message}`;
    logEl.appendChild(entry);
    logEl.scrollTop = logEl.scrollHeight;
    // Limit entries to 100
    while (logEl.children.length > 100) {
      logEl.removeChild(logEl.firstChild);
    }
  }
}

// Instantiate the controller when DOM is ready
let streamController;
document.addEventListener('DOMContentLoaded', () => {
  streamController = new StreamSwitcher();
});

// Expose a few global functions for buttons
function testConnection() {
  streamController.testServerConnection();
}
function refreshStreams() {
  streamController.refreshStreams();
}
function nextStream() {
  streamController.nextStream();
}
function previousStream() {
  streamController.previousStream();
}