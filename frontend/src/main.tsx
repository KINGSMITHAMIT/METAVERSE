import { createRoot } from 'react-dom/client'
import '@fontsource-variable/dm-sans/wght.css'
import '@fontsource-variable/space-grotesk/wght.css'

const entry =
  new URLSearchParams(location.search).get('space') === 'team'
    ? import('./TeamWorkspace')
    : import('./world/KiitWorld')
entry.then(({ default: Screen }) => createRoot(document.getElementById('root')!).render(<Screen />))
