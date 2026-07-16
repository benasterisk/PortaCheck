// Client API léger — tout est local (même origine en prod, proxy en dev).

async function req(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail
    try {
      const body = await res.json()
      detail = body.detail
    } catch {
      detail = res.statusText
    }
    // detail peut être une string ou un objet {error, kind}
    const message = typeof detail === 'object' && detail !== null ? detail.error : detail
    const err = new Error(message || `Erreur ${res.status}`)
    err.status = res.status
    err.detail = detail
    throw err
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return res
}

export const api = {
  // Profil & santé
  getProfile: () => req('/api/profile'),
  getHealth: () => req('/api/health'),

  // Campagnes
  listCampaigns: () => req('/api/campaigns'),
  createCampaign: (name, notes = '') =>
    req('/api/campaigns', { method: 'POST', body: JSON.stringify({ name, notes }) }),
  getCampaign: (id) => req(`/api/campaigns/${id}`),
  deleteCampaign: (id) => req(`/api/campaigns/${id}`, { method: 'DELETE' }),

  // Import (collage / texte)
  importPreview: (id, text) =>
    req(`/api/campaigns/${id}/import/preview`, { method: 'POST', body: JSON.stringify({ text }) }),
  importCommit: (id, text) =>
    req(`/api/campaigns/${id}/import/commit`, { method: 'POST', body: JSON.stringify({ text }) }),

  // Import (fichier tabulaire xlsx/csv/tsv avec mapping de colonnes)
  importAnalyze: (id, filename, contentB64) =>
    req(`/api/campaigns/${id}/import/analyze`, {
      method: 'POST',
      body: JSON.stringify({ filename, content_b64: contentB64 }),
    }),
  importPreviewTabular: (id, payload) =>
    req(`/api/campaigns/${id}/import/preview-tabular`, { method: 'POST', body: JSON.stringify(payload) }),
  importCommitTabular: (id, payload) =>
    req(`/api/campaigns/${id}/import/commit-tabular`, { method: 'POST', body: JSON.stringify(payload) }),

  // SIM
  getSims: () => req('/api/sims'),
  refreshSims: () => req('/api/sims/refresh', { method: 'POST' }),

  // Passes
  createRun: (payload) => req('/api/runs', { method: 'POST', body: JSON.stringify(payload) }),
  listRuns: () => req('/api/runs'),
  getRun: (id, opts = {}) => req(`/api/runs/${id}${opts.resume ? '?resume=true' : ''}`),
  getRunNumbers: (id) => req(`/api/runs/${id}/numbers`),
  getRunNumberAt: (id, index) => req(`/api/runs/${id}/at/${index}`),
  getCommentSuggestions: () => req('/api/comment-suggestions'),
  stopRun: (id) => req(`/api/runs/${id}/stop`, { method: 'POST' }),
  finishRun: (id) => req(`/api/runs/${id}/finish`, { method: 'POST' }),

  // Actions d'appel
  dial: (runId, numberId) =>
    req(`/api/runs/${runId}/dial`, { method: 'POST', body: JSON.stringify({ number_id: numberId }) }),
  hangup: (runId) => req(`/api/runs/${runId}/hangup`, { method: 'POST' }),
  verdict: (runId, payload) =>
    req(`/api/runs/${runId}/verdict`, { method: 'POST', body: JSON.stringify(payload) }),

  // Rapport & journal
  getReport: (id) => req(`/api/campaigns/${id}/report`),
  getLogs: (limit = 200) => req(`/api/logs?limit=${limit}`),

  exportUrl: (id, fmt) => `/api/campaigns/${id}/export/${fmt}`,
}
