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

async function initAdminDashboard() {
  const refreshBtn = document.getElementById('refreshBtn');
  const searchInput = document.getElementById('adminSearch');
  const exportBtn = document.getElementById('exportJsonBtn');
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

  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'all';
      renderTable();
    });
  });

  await loadSubmissions();
}

async function loadSubmissions() {
  const statusEl = document.getElementById('adminLoadingStatus');
  if (statusEl) statusEl.textContent = 'Loading messages from App Storage...';

  try {
    const res = await fetch('/api/contact');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const data = await res.json();
    contactList = data.submissions || [];
    updateStats();
    renderTable();
    if (statusEl) statusEl.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
  } catch (err) {
    console.error('Failed to load submissions:', err);
    if (statusEl) {
      statusEl.textContent = 'Error loading contact submissions from server.';
      statusEl.style.color = '#ef4444';
    }
  }
}

function updateStats() {
  const totalCountEl = document.getElementById('totalCount');
  const pendingCountEl = document.getElementById('pendingCount');
  const repliedCountEl = document.getElementById('repliedCount');

  const total = contactList.length;
  const pending = contactList.filter((c) => !c.replied).length;
  const replied = contactList.filter((c) => c.replied).length;

  if (totalCountEl) totalCountEl.textContent = total;
  if (pendingCountEl) pendingCountEl.textContent = pending;
  if (repliedCountEl) repliedCountEl.textContent = replied;
}

function renderTable() {
  const tbody = document.getElementById('adminTableBody');
  const emptyMessage = document.getElementById('adminEmptyMessage');
  const searchInput = document.getElementById('adminSearch');
  const searchTerm = (searchInput?.value || '').toLowerCase();

  if (!tbody) return;

  // Filter based on filter button
  let filtered = contactList.filter((item) => {
    if (currentFilter === 'pending') return !item.replied;
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
      : '<span class="badge badge-pending">Pending</span>';

    const actionText = item.replied ? 'Mark Pending' : 'Mark Replied';

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
