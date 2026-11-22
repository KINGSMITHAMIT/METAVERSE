import { writeFile } from 'node:fs/promises'

const origin = process.env.BASE_URL ?? 'http://127.0.0.1:8080'
const count = Number(process.env.CLIENTS ?? 100)
const roomCount = 5
const run = 'load' + Date.now().toString(36)
const password = 'local-k6-setup-password'

function account() {
  let cookie = ''
  let csrf = ''
  async function request(path, data) {
    const response = await fetch(origin + '/api' + path, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(csrf && { 'X-CSRF-TOKEN': csrf }), ...(cookie && { Cookie: cookie }) },
      body: data === undefined ? undefined : JSON.stringify(data),
    })
    if (!response.ok) throw new Error(path + ' returned ' + response.status)
    if (response.headers.has('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0]
    return response.headers.get('content-type')?.includes('application/json') ? response.json() : undefined
  }
  return {
    get cookie() { return cookie },
    request,
    async enroll(username) {
      csrf = (await request('/csrf')).token
      await request('/register', { username, password })
      await request('/login', { username, password })
    },
  }
}

const admin = account()
await admin.enroll(run + '-admin')
const titles = ['crowd', ...Array.from({ length: roomCount }, (_, index) => 'group-' + index)]
const rooms = await Promise.all(titles.map(title => admin.request('/workspaces', { title: run + '-' + title })))
const memberships = []
for (let offset = 0; offset < count; offset += 8) {
  await Promise.all(Array.from({ length: Math.min(8, count - offset) }, async (_, index) => {
    const i = offset + index
    const username = run + '-' + i
    const client = account()
    const group = rooms[1 + i % roomCount]
    await client.enroll(username)
    for (const room of [rooms[0], group]) {
      const { code } = await admin.request('/workspaces/' + room.id + '/invites', { username })
      await client.request('/workspaces/accept', { code })
    }
    memberships[i] = { username, crowd: rooms[0].id, split: group.id }
  }))
}
await writeFile(process.env.ROSTER ?? '/tmp/campus-bench.json', JSON.stringify({ password, memberships }), { mode: 0o600 })
console.log('Provisioned', memberships.length, 'clients for one crowded and five split workspaces.')
