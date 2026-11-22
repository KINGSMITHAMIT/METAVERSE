import sceneNames from './data/scenes.json'

export const TOUR = 'https://www.immersivetourz.com/kiit/index.html'
export const scenes = sceneNames.map(([name, ...groups], i) => ({ name, groups, number: i + 1 }))
export const tourUrl = (number: number) => TOUR + '#media=' + number

export interface Place {
  id: string
  name: string
  short: string
  group: 'Campus' | 'Learning' | 'Sports' | 'Gardens' | 'Health' | 'Dining' | 'Residence'
  description: string
  scene?: number
  sceneLabel?: string
}

export const places: Place[] = [
  {
    id: 'w1109132946',
    name: 'Main Campus',
    short: 'Main Campus',
    group: 'Campus',
    description: 'Explore Campus 6 and its auditorium along KIIT Road.',
    scene: 43,
    sceneLabel: 'Visit the convention centre',
  },
  {
    id: 'w1384184361',
    name: 'KIIT Central Library',
    short: 'Central Library',
    group: 'Learning',
    description: 'Find the central library just north of Campus 3.',
    scene: 46,
    sceneLabel: 'Enter the central library',
  },
  {
    id: 'w1383668015',
    name: 'KIIT Cricket Ground',
    short: 'Cricket Ground',
    group: 'Sports',
    description: 'Explore the oval at Campus 13, south-east of the Dutee Chand Stadium.',
    scene: 377,
  },
  {
    id: 'w1133134578',
    name: 'Dutee Chand Stadium',
    short: 'Dutee Chand Stadium',
    group: 'Sports',
    description: 'Step inside the athletics stadium or explore its surroundings on the map.',
    scene: 390,
  },
  {
    id: 'w1415871974',
    name: 'Campus 3',
    short: 'Campus 3',
    group: 'Campus',
    description: 'Explore the campus between the central library and KIIT Road.',
    scene: 3,
  },
  {
    id: 'w1415871975',
    name: 'KSOM Gardens',
    short: 'KSOM Gardens',
    group: 'Gardens',
    description: 'The garden library at KIIT School of Management, south of the main campus.',
  },
  {
    id: 'w1133129493',
    name: 'School of Computer Engineering',
    short: 'Computer Engineering',
    group: 'Learning',
    description: 'Find the School of Computer Engineering on the southern side of the campus district.',
    scene: 92,
  },
  {
    id: 'w1264588348',
    name: 'Campus 6 Auditorium',
    short: 'Campus 6 Auditorium',
    group: 'Campus',
    description: 'A mapped auditorium within the main campus grounds.',
  },
  {
    id: 'w1383663640',
    name: 'Architecture Building',
    short: 'Architecture Building',
    group: 'Learning',
    description: 'Explore the architecture building south of the KSOM gardens.',
    scene: 242,
  },
  {
    id: 'w1383667721',
    name: 'Mechanical Food Court',
    short: 'Mechanical Food Court',
    group: 'Dining',
    description: 'Find this dining stop beside the main campus.',
  },
  {
    id: 'n7078964748',
    name: 'Pradyumna Bal Memorial Hospital',
    short: 'KIMS Hospital',
    group: 'Health',
    description: 'The Kalinga Institute of Medical Sciences hospital, west of Campus 3.',
  },
  {
    id: 'n4578805794',
    name: 'Kalinga Institute of Social Sciences',
    short: 'KISS',
    group: 'Campus',
    description: 'Explore the neighbouring KISS campus north-west of the KIIT athletics grounds.',
  },
  {
    id: 'w1133129896',
    name: "King's Palace 6 A & B",
    short: 'KP 6 A & B',
    group: 'Residence',
    description: "Student residences mapped as King's Palace 6AB.",
  },
  {
    id: 'r19083628',
    name: "King's Palace 7 A & B",
    short: 'KP 7 A & B',
    group: 'Residence',
    description: "Explore the King's Palace residence and its university-hosted exterior view.",
    scene: 408,
  },
  {
    id: 'w1264588325',
    name: "King's Palace 7C",
    short: 'KP 7C',
    group: 'Residence',
    description: "One of the mapped buildings in the King's Palace 7 residence complex.",
  },
  {
    id: 'w1264588326',
    name: "King's Palace 7D",
    short: 'KP 7D',
    group: 'Residence',
    description: 'Visit the 7D residence in the official campus tour.',
    scene: 410,
  },
  {
    id: 'w1264588331',
    name: "King's Palace 7E",
    short: 'KP 7E',
    group: 'Residence',
    description: "One of the mapped buildings in the King's Palace 7 residence complex.",
  },
  {
    id: 'w1264588330',
    name: "King's Palace 7F",
    short: 'KP 7F',
    group: 'Residence',
    description: "One of the mapped buildings in the King's Palace 7 residence complex.",
  },
]
