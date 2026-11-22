export type Rect = { x: number; y: number; width: number; height: number }
export type MapData = { width: number; height: number; meeting: Rect; walls: Rect[]; tables: Rect[] }
export type Player = { username: string; x: number; y: number }
export type Workspace = { id: string; title: string; owner: string }
export type Details = MapData & {
  workspace: Workspace
  members: { username: string; voiceBlocked: boolean }[]
}
export type Direction = 'up' | 'right' | 'down' | 'left'

export function inside(rect: Rect, player: Player) {
  return player.x >= rect.x && player.y >= rect.y &&
    player.x < rect.x + rect.width && player.y < rect.y + rect.height
}

export async function api<T>(path: string, method = 'GET', data?: object): Promise<T> {
  const headers: Record<string, string> = {}
  if (method !== 'GET') {
    const response = await fetch('/api/csrf')
    if (!response.ok) throw new Error('Could not start a secure request.')
    headers['X-CSRF-TOKEN'] = (await response.json()).token
    headers['Content-Type'] = 'application/json'
  }
  const response = await fetch('/api' + path, { method, headers, body: data && JSON.stringify(data) })
  if (!response.ok) {
    const messages: Record<number, string> = {
      400: 'Check the information you entered and try again.',
      401: 'Your account details did not match or your session expired.',
      403: 'You don’t have access to do that here.',
      409: 'That username is taken or a previous session is closing.',
      503: 'Voice is offline.',
    }
    throw new Error(messages[response.status] ?? 'The server could not complete your request.')
  }
  return response.status === 204 || !response.headers.get('content-type')?.includes('application/json')
    ? undefined as T : response.json()
}
