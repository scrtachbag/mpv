// Reconnaissance d'une équipe depuis son nom PCS -> sigle + couleur de marque.
// Sert à afficher une pastille d'équipe (lettres + couleur), pas un avatar.
const TEAMS = [
  { match: /uae/,                       code: 'UAE', color: '#1c1c1c', label: 'UAE Team Emirates' },
  { match: /visma/,                     code: 'VIS', color: '#fde047', fg: '#1b1c22', label: 'Visma | Lease a Bike' },
  { match: /quick.?step|soudal/,        code: 'SQS', color: '#0a1f8f', label: 'Soudal Quick-Step' },
  { match: /ineos/,                     code: 'INE', color: '#1e2a4a', label: 'INEOS Grenadiers' },
  { match: /lidl|trek/,                 code: 'LTK', color: '#d4002a', label: 'Lidl-Trek' },
  { match: /bora|red.?bull/,            code: 'BOR', color: '#0e2148', label: 'Red Bull–BORA–hansgrohe' },
  { match: /bahrain/,                   code: 'BAH', color: '#bd0029', label: 'Bahrain Victorious' },
  { match: /groupama|fdj/,              code: 'FDJ', color: '#0050b5', label: 'Groupama-FDJ' },
  { match: /decathlon|ag2r/,            code: 'DEC', color: '#0a1b6b', label: 'Decathlon AG2R La Mondiale' },
  { match: /ef education|easypost/,     code: 'EF',  color: '#ff2e8b', label: 'EF Education–EasyPost' },
  { match: /movistar/,                  code: 'MOV', color: '#13205e', label: 'Movistar Team' },
  { match: /jayco|alula/,               code: 'JAY', color: '#10b0a4', label: 'Team Jayco AlUla' },
  { match: /intermarch|wanty/,          code: 'IWA', color: '#6b2c8f', label: 'Intermarché–Wanty' },
  { match: /cofidis/,                   code: 'COF', color: '#d6001c', label: 'Cofidis' },
  { match: /astana/,                    code: 'AST', color: '#1fb6e6', label: 'Astana Qazaqstan' },
  { match: /alpecin/,                   code: 'ALP', color: '#e3007a', label: 'Alpecin–Deceuninck' },
  { match: /ark[ée]a/,                  code: 'ARK', color: '#cf102d', label: 'Arkéa–B&B Hotels' },
  { match: /israel|premier.?tech/,      code: 'IPT', color: '#f15a22', label: 'Israel–Premier Tech' },
  { match: /totalenergies|total ?energies/, code: 'TOT', color: '#1a3b8b', label: 'TotalEnergies' },
  { match: /uno.?x/,                    code: 'UNO', color: '#e4002b', label: 'Uno-X Mobility' },
  { match: /lotto/,                     code: 'LOT', color: '#e2001a', label: 'Lotto' },
]

export function teamInfo(name) {
  const n = (name || '').toLowerCase()
  if (!n) return null
  for (const t of TEAMS) if (t.match.test(n)) return t
  return null
}
