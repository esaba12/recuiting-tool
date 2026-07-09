export function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function buildGraph(contacts) {
  const nodes = []
  const links = []
  const companyId = (name) => `company:${name.trim().toLowerCase()}`
  const seenCompanies = new Set()

  contacts.forEach(c => {
    nodes.push({ id: c.id, kind: 'contact', label: c.name, contact: c })
    if (c.company?.trim()) {
      const cid = companyId(c.company)
      if (!seenCompanies.has(cid)) {
        seenCompanies.add(cid)
        nodes.push({ id: cid, kind: 'company', label: c.company.trim() })
      }
      links.push({ source: c.id, target: cid, kind: 'works-at' })
    }
    if (c.referredById) {
      links.push({ source: c.referredById, target: c.id, kind: 'referred-by' })
    }
  })

  return { nodes, links }
}
