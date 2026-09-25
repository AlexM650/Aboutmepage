/**
 * Alex Mckee - Admin Dashboard JavaScript
 * Fetches contact submissions from GET /api/contact
 * Updates status via PATCH /api/contact/:id/reply
 * Manages stats, filters, search, and JSON export
 */

document.addEventListener('DOMContentLoaded', () => {
  initAdminDashboard();
});

let contactList = [];
let currentFilter = 'all';
let submissionRequestActive = false;

async function initAdminDashboard() {
  const refreshBtn = document.getElementById('refreshBtn');
  const searchInput = document.getElementById('adminSearch');
  const exportBtn = document.getElementById('exportJsonBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const filterBtns = document.querySelectorAll('.filter-btn');

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadSubmissions());
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => renderTable());
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => exportDataJson());
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/admin/logout', { method: 'POST' });
      window.location.href = '/admin.html';
    });
  }

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'all';
      renderTable();
    });
  });

  await loadSubmissions();
  window.setInterval(() => {
    if (!document.hidden) loadSubmissions();
  }, 30000);
}

async function loadSubmissions() {
  if (submissionRequestActive) return;
  submissionRequestActive = true;

  const statusEl = document.getElementById('adminLoadingStatus');
  const chart = document.getElementById('reasonChart');
  if (chart) chart.setAttribute('aria-busy', 'true');
  if (statusEl) statusEl.textContent = 'Loading messages from App Storage...';

  try {
    const res = await fetch('/api/contact');
    if (res.status === 401) {
      window.location.href = '/admin.html';
      return;
    }
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    contactList = Array.isArray(data.submissions) ? data.submissions : [];
    updateStats();
    renderTable();
    if (statusEl) statusEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error('Failed to load submissions:', err);
    if (statusEl) {
      statusEl.textContent = 'Error loading contact submissions from server.';
      statusEl.style.color = '#ef4444';
    }
    if (chart) {
      chart.replaceChildren();
      chart.setAttribute('aria-busy', 'false');
      const chartError = document.createElement('p');
      chartError.className = 'reason-chart-empty';
      chartError.textContent = 'Reason totals could not be loaded.';
      chart.appendChild(chartError);
    }
  } finally {
    submissionRequestActive = false;
  }
}

function updateStats() {
  const totalCountEl = document.getElementById('totalCount');
  const newCountEl = document.getElementById('newCount');
  const repliedCountEl = document.getElementById('repliedCount');
  const replyRateEl = document.getElementById('replyRate');

  const total = contactList.length;
  const newMessages = contactList.filter((c) => !c.replied).length;
  const replied = contactList.filter((c) => c.replied).length;
  const replyRate = total === 0 ? 0 : Math.round((replied / total) * 100);

  if (totalCountEl) totalCountEl.textContent = total;
  if (newCountEl) newCountEl.textContent = newMessages;
  if (repliedCountEl) repliedCountEl.textContent = replied;
  if (replyRateEl) replyRateEl.textContent = `${replyRate}%`;
  updateReasonChart();
}

function updateReasonChart() {
  const chart = document.getElementById('reasonChart');
  if (!chart) return;

  chart.replaceChildren();
  chart.setAttribute('aria-busy', 'false');

  const counts = new Map();
  contactList.forEach((submission) => {
    const reason = typeof submission.reason === 'string' && submission.reason.trim()
      ? submission.reason.trim()
      : 'Unspecified';
    counts.set(reason, (counts.get(reason) || 0) + 1);
  });

  if (counts.size === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'reason-chart-empty';
    emptyState.textContent = 'No contact messages to chart yet.';
    chart.appendChild(emptyState);
    return;
  }

  const entries = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const highestCount = entries[0][1];

  entries.forEach(([reason, count]) => {
    const row = document.createElement('div');
    row.className = 'reason-chart-row';
    row.setAttribute('role', 'listitem');

    const label = document.createElement('span');
    label.className = 'reason-chart-label';
    label.textContent = reason;

    const track = document.createElement('span');
    track.className = 'reason-chart-track';
    track.setAttribute('aria-hidden', 'true');

    const bar = document.createElement('span');
    bar.className = 'reason-chart-bar';
    bar.style.width = `${(count / highestCount) * 100}%`;
    track.appendChild(bar);

    const value = document.createElement('span');
    value.className = 'reason-chart-count';
    value.textContent = `${count} ${count === 1 ? 'message' : 'messages'}`;

    row.append(label, track, value);
    chart.appendChild(row);
  });
}

function renderTable() {
  const tbody = document.getElementById('adminTableBody');
  const emptyMessage = document.getElementById('adminEmptyMessage');
  const searchInput = document.getElementById('adminSearch');
  const searchTerm = (searchInput?.value || '').toLowerCase();

  if (!tbody) return;

  // Filter based on filter button
  let filtered = contactList.filter((item) => {
    if (currentFilter === 'new') return !item.replied;
    if (currentFilter === 'replied') return item.replied;
    return true;
  });

  // Filter based on search query
  if (searchTerm) {
    filtered = filtered.filter((item) => {
      const full = `${item.firstName} ${item.lastName} ${item.email} ${item.reason} ${item.message}`.toLowerCase();
      return full.includes(searchTerm);
    });
  }

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    if (emptyMessage) emptyMessage.style.display = 'block';
    return;
  } else {
    if (emptyMessage) emptyMessage.style.display = 'none';
  }

  filtered.forEach((item) => {
    const tr = document.createElement('tr');
    tr.id = `row-${item.id}`;

    const dateStr = item.submittedAt
      ? new Date(item.submittedAt).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : 'Unknown';

    const statusBadge = item.replied
      ? '<span class="badge badge-replied">Replied</span>'
      : '<span class="badge badge-pending">New</span>';

    const actionText = item.replied ? 'Mark as New' : 'Mark as Replied';

    tr.innerHTML = `
      <td style="white-space: nowrap; font-family: var(--font-mono); font-size: 0.8rem; color: #64748b;">
        ${escapeHtml(dateStr)}
      </td>
      <td style="font-weight: 600;">
        ${escapeHtml(item.firstName)} ${escapeHtml(item.lastName)}
      </td>
      <td>
        <a href="mailto:${escapeHtml(item.email)}" style="color: var(--color-blue-600); text-decoration: none;">
          ${escapeHtml(item.email)}
        </a>
      </td>
      <td>
        <span class="badge badge-reason">${escapeHtml(item.reason || 'Other')}</span>
      </td>
      <td style="max-width: 320px; word-break: break-word;">
        ${escapeHtml(item.message)}
      </td>
      <td style="white-space: nowrap;">
        ${statusBadge}
      </td>
      <td style="white-space: nowrap;">
        <div style="display: flex; gap: 0.4rem;">
          <button type="button" class="btn btn-primary toggle-reply-btn" data-id="${item.id}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem; min-height: 36px;">
            ${actionText}
          </button>
          <button type="button" class="btn btn-dark delete-btn" data-id="${item.id}" style="padding: 0.35rem 0.65rem; font-size: 0.8rem; min-height: 36px;" title="Delete message">
            ✕
          </button>
        </div>
      </td>
    `;

    tbody.appendChild(tr);
  });

  // Attach toggle listeners
  document.querySelectorAll('.toggle-reply-btn').forEach((btn) => {
    btn.addEventListener('click', () => toggleReplyStatus(btn.dataset.id));
  });

  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => deleteSubmission(btn.dataset.id));
  });
}

async function toggleReplyStatus(id) {
  try {
    const res = await fetch(`/api/contact/${id}/reply`, { method: 'PATCH' });
    if (res.status === 401) {
      window.location.href = '/admin.html';
      return;
    }
    if (!res.ok) throw new Error('Failed to toggle status');
    const data = await res.json();
    
    // Update local cache
    const index = contactList.findIndex((item) => item.id === id);
    if (index !== -1 && data.record) {
      contactList[index] = data.record;
      updateStats();
      renderTable();
    }
  } catch (err) {
    alert('Error updating status: ' + err.message);
  }
}

async function deleteSubmission(id) {
  if (!confirm('Are you sure you want to delete this message record?')) return;
  try {
    const res = await fetch(`/api/contact/${id}`, { method: 'DELETE' });
    if (res.status === 401) {
      window.location.href = '/admin.html';
      return;
    }
    if (!res.ok) throw new Error('Failed to delete');
    contactList = contactList.filter((item) => item.id !== id);
    updateStats();
    renderTable();
  } catch (err) {
    alert('Error deleting message: ' + err.message);
  }
}

function exportDataJson() {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(contactList, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute('href', dataStr);
  downloadAnchor.setAttribute('download', 'contactReceived.json');
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
