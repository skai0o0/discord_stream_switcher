// Discord Stream Deck Integration
// Script để chuyển stream Discord thông qua Stream Deck
// Sử dụng Chrome Remote Debugging để control Discord

(function() {
    'use strict';

    // ===== CONFIGURATION =====
    let CURRENT_STREAM_IDS = [];
    let CURRENT_STREAM_INDEX = 0;

    // ===== STREAM DETECTION & MANAGEMENT =====

    // Hàm lấy tất cả Stream IDs và tên streamer hiện có
    function getCurrentStreamIds() {
        try {
            const tiles = [...document.querySelectorAll('div[data-selenium-video-tile] .focusTarget__54e4b[role="button"]')];
            const streamData = tiles.map((el, index) => {
                const videoTile = el.closest('[data-selenium-video-tile]');
                const streamId = videoTile.dataset.seleniumVideoTile;
                const streamName = `Stream ${index + 1}`;
                return { id: streamId, name: streamName };
            });
            return streamData;
        } catch (error) {
            console.error('❌ Error getting stream data:', error);
            return [];
        }
    }

    // Refresh the internal list of streams.
    function refreshStreams() {
        CURRENT_STREAM_IDS = getCurrentStreamIds();
        return CURRENT_STREAM_IDS;
    }

    // Switch by ID
    function switchToStreamById(streamId) {
        try {
            const targetTile = document.querySelector(`div[data-selenium-video-tile="${streamId}"]`);
            if (targetTile) {
                const button = targetTile.querySelector('.focusTarget__54e4b[role="button"]');
                if (button) {
                    button.click();
                    CURRENT_STREAM_INDEX = CURRENT_STREAM_IDS.findIndex(stream => (typeof stream === 'string' ? stream : stream.id) === streamId);
                    const streamData = CURRENT_STREAM_IDS[CURRENT_STREAM_INDEX];
                    const streamerName = (typeof streamData === 'object' && streamData.name) ? streamData.name : `Stream ${CURRENT_STREAM_INDEX + 1}`;
                    showNotification(`Switched to ${streamerName}`, streamId);
                    return true;
                }
            }
            console.warn(`Stream ${streamId} not found`);
            return false;
        } catch (error) {
            console.error('Error switching stream:', error);
            return false;
        }
    }

    // Switch by index
    function switchToStreamByIndex(index) {
        if (index < 0 || index >= CURRENT_STREAM_IDS.length) {
            console.warn(`Invalid stream index: ${index}. Available: 0-${CURRENT_STREAM_IDS.length - 1}`);
            return false;
        }
        const streamData = CURRENT_STREAM_IDS[index];
        const streamId = typeof streamData === 'string' ? streamData : streamData.id;
        return switchToStreamById(streamId);
    }

    // Cycle next
    function switchToNextStream() {
        if (CURRENT_STREAM_IDS.length === 0) {
            refreshStreams();
        }
        if (CURRENT_STREAM_IDS.length === 0) {
            console.warn('No streams available');
            return false;
        }
        CURRENT_STREAM_INDEX = (CURRENT_STREAM_INDEX + 1) % CURRENT_STREAM_IDS.length;
        return switchToStreamByIndex(CURRENT_STREAM_INDEX);
    }

    // Cycle previous
    function switchToPreviousStream() {
        if (CURRENT_STREAM_IDS.length === 0) {
            refreshStreams();
        }
        if (CURRENT_STREAM_IDS.length === 0) {
            console.warn('No streams available');
            return false;
        }
        CURRENT_STREAM_INDEX = (CURRENT_STREAM_INDEX - 1 + CURRENT_STREAM_IDS.length) % CURRENT_STREAM_IDS.length;
        return switchToStreamByIndex(CURRENT_STREAM_INDEX);
    }

    // ===== NOTIFICATION =====
    function showNotification(title, subtitle = '') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #7289da, #5865f2);
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 14px;
            max-width: 300px;
            transition: all 0.3s ease;
        `;
        notification.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">${title}</div>
            ${subtitle ? `<div style="font-size: 12px; opacity: 0.9;">${subtitle}</div>` : ''}
        `;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // ===== STREAM DECK API =====
    function handleStreamDeckCommand(command, data = {}) {
        switch (command) {
            case 'refresh':
                refreshStreams();
                showNotification('Streams Refreshed', `Found ${CURRENT_STREAM_IDS.length} streams`);
                break;
            case 'switch_by_id':
                if (data.streamId) {
                    switchToStreamById(data.streamId);
                }
                break;
            case 'switch_by_index':
                if (typeof data.index === 'number') {
                    switchToStreamByIndex(data.index);
                }
                break;
            case 'next':
                switchToNextStream();
                break;
            case 'previous':
                switchToPreviousStream();
                break;
            case 'get_streams':
                return {
                    streams: CURRENT_STREAM_IDS,
                    currentIndex: CURRENT_STREAM_INDEX
                };
            default:
                console.warn('Unknown Stream Deck command:', command);
                return { error: 'Unknown command' };
        }
        return { success: true };
    }

    // ===== INITIALIZATION =====
    function initialize() {
        refreshStreams();
        showNotification('Stream Deck Ready', `Found ${CURRENT_STREAM_IDS.length} streams`);
        setInterval(refreshStreams, 30000);
    }

    window.DiscordStreamDeck = {
        refreshStreams,
        switchToStreamById,
        switchToStreamByIndex,
        switchToNextStream,
        switchToPreviousStream,
        getCurrentStreamIds,
        handleCommand: handleStreamDeckCommand,
        getStatus: () => ({
            streams: CURRENT_STREAM_IDS,
            currentIndex: CURRENT_STREAM_INDEX,
            totalStreams: CURRENT_STREAM_IDS.length
        })
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }

    // Keyboard shortcuts for F1-F12 and arrow keys
    document.addEventListener('keydown', (event) => {
        if (event.ctrlKey && event.shiftKey && event.key.startsWith('F')) {
            event.preventDefault();
            const fNumber = parseInt(event.key.replace('F', ''));
            if (fNumber >= 1 && fNumber <= 12) {
                switchToStreamByIndex(fNumber - 1);
            }
        }
        if (event.ctrlKey && event.shiftKey) {
            if (event.key === 'ArrowRight') {
                event.preventDefault();
                switchToNextStream();
            } else if (event.key === 'ArrowLeft') {
                event.preventDefault();
                switchToPreviousStream();
            }
        }
    });
})();