document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('campaign-form');
    const startBtn = document.getElementById('start-btn');
    const templateSelect = document.getElementById('template');
    const csvSelect = document.getElementById('csv');
    const csvUpload = document.getElementById('csv-upload');
    const terminal = document.getElementById('terminal');
    const clearLogsBtn = document.getElementById('clear-logs');
    
    // Status indicators
    const statusIndicator = document.querySelector('.status-indicator');
    const systemStatusText = document.getElementById('system-status');
    
    // Limits
    const limitConfigs = {
        resend: 100, // Make sure these match backend env defaults
        brevo: 300,
        mailersend: 200
    };

    // Load initial data
    fetchData();
    setupEventSource();

    async function fetchData() {
        try {
            // Load templates
            const tplRes = await fetch('/api/templates');
            const templates = await tplRes.json();
            templateSelect.innerHTML = '<option value="" disabled selected>Select template</option>';
            templates.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t;
                opt.textContent = t;
                templateSelect.appendChild(opt);
            });

            await fetchCSVs();

            // Update status
            await fetchStatus();
        } catch (err) {
            appendLog('error', `Failed to load initialization data: ${err.message}`);
        }
    }

    async function fetchCSVs() {
        try {
            const csvRes = await fetch('/api/csvs');
            const csvs = await csvRes.json();
            csvSelect.innerHTML = '<option value="" disabled selected>Select contact list</option>';
            csvs.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                csvSelect.appendChild(opt);
            });
        } catch (err) {
            appendLog('error', `Failed to fetch CSVs: ${err.message}`);
        }
    }

    async function fetchStatus() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            updateStatusUI(data.isRunning);
            updateQuotas(data.capacity);
        } catch (err) {
            console.error(err);
        }
    }

    function updateStatusUI(isRunning) {
        if (isRunning) {
            statusIndicator.classList.add('running');
            systemStatusText.textContent = 'Campaign Running';
            startBtn.disabled = true;
            startBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"></line><line x1="12" y1="18" x2="12" y2="22"></line><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line><line x1="2" y1="12" x2="6" y2="12"></line><line x1="18" y1="12" x2="22" y2="12"></line><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line><line x1="16.24" y1="4.93" x2="19.07" y2="7.76"></line></svg> Processing...';
        } else {
            statusIndicator.classList.remove('running');
            systemStatusText.textContent = 'System Ready';
            startBtn.disabled = false;
            startBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Start Campaign';
        }
    }

    function updateQuotas(capacity) {
        ['resend', 'brevo', 'mailersend'].forEach(provider => {
            const rem = capacity[provider];
            const max = limitConfigs[provider];
            const used = max - rem;
            const pct = (used / max) * 100;
            
            document.getElementById(`quota-${provider}`).textContent = `${used}/${max}`;
            document.getElementById(`prog-${provider}`).style.width = `${pct}%`;
        });
    }

    function appendLog(type, message) {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        line.textContent = message;
        terminal.appendChild(line);
        terminal.scrollTop = terminal.scrollHeight;
    }

    function setupEventSource() {
        const evtSource = new EventSource('/api/logs/stream');
        
        evtSource.onmessage = function(event) {
            const data = JSON.parse(event.data);
            appendLog(data.type, data.message);
            
            if (data.message.includes('=== DONE ===')) {
                // Campaign finished, refresh status
                fetchStatus();
            } else if (data.message.includes('Sent ')) {
                // Heuristic to update quotas slightly delayed, but nice for visual sync
                fetchStatus();
            }
        };

        evtSource.onerror = function() {
            console.log("SSE Connection lost. Reconnecting...");
        };
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const payload = {
            campaignName: document.getElementById('campaignName').value,
            subject: document.getElementById('subject').value,
            template: templateSelect.value,
            csv: csvSelect.value,
            dryRun: document.getElementById('dryRun').checked
        };

        try {
            const res = await fetch('/api/campaign/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            const data = await res.json();
            if (res.ok) {
                appendLog('sys', 'Command accepted. Starting campaign...');
                updateStatusUI(true);
            } else {
                appendLog('error', `Failed to start: ${data.error}`);
            }
        } catch (err) {
            appendLog('error', `Network error: ${err.message}`);
        }
    });

    csvUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('csvFile', file);

        appendLog('sys', `Uploading ${file.name}...`);
        
        try {
            const res = await fetch('/api/upload-csv', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();
            
            if (res.ok) {
                appendLog('sys', `Success: ${data.message}`);
                await fetchCSVs();
                csvSelect.value = data.filename;
            } else {
                appendLog('error', `Upload failed: ${data.error}`);
            }
        } catch (err) {
            appendLog('error', `Upload error: ${err.message}`);
        }
        
        e.target.value = ''; // Reset input
    });

    clearLogsBtn.addEventListener('click', () => {
        terminal.innerHTML = '<div class="log-line sys">Logs cleared.</div>';
    });
});
