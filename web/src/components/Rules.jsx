export default function Rules() {
  return (
    <div className="stack rules">
      <div className="dash-hero">
        <div>
          <h1>📖 Les règles du jeu</h1>
          <p>Parie entre amis sur le Tour de France — sans argent, pour la gloire.</p>
        </div>
        <div className="hero-jerseys"><span>🟡</span><span>🚴</span></div>
      </div>

      <div className="card">
        <h2>🎯 Le principe</h2>
        <p>Chaque jour de course, tu paries sur le <strong>coureur que tu vois gagner l’étape</strong>.
          Plus ton pronostic est audacieux et juste, plus tu marques de points. Le but : finir
          en tête du classement à la fin du Tour.</p>
      </div>

      <div className="card">
        <h2>⏳ Comment parier</h2>
        <ul className="rules-list">
          <li>Va dans <strong>« Le Tour »</strong> et choisis un coureur parmi les partants du jour.</li>
          <li>Chaque coureur a une <strong>côte</strong> : basse pour un favori, élevée pour un outsider.</li>
          <li>Tu peux changer ton pari autant que tu veux <strong>jusqu’à midi (12h00)</strong>.</li>
          <li>À midi, les paris sont <strong>verrouillés</strong> : impossible de modifier après.</li>
          <li>Un seul pari par étape.</li>
        </ul>
      </div>

      <div className="card">
        <h2>🧮 Les points</h2>
        <p>À la fin de l’étape :</p>
        <p className="formula">points = côte du coureur ÷ sa place</p>
        <ul className="rules-list">
          <li><strong>× 2</strong> si ton coureur <strong>gagne l’étape</strong> (1ᵉ).</li>
          <li><strong>0 point</strong> s’il finit <strong>hors du top 10</strong>.</li>
        </ul>
        <div className="example">
          <strong>Exemples</strong> — côte de 8.0 :
          <ul className="rules-list">
            <li>il finit 4ᵉ → 8 ÷ 4 = <strong>2 pts</strong></li>
            <li>il finit 2ᵉ → 8 ÷ 2 = <strong>4 pts</strong></li>
            <li>il <strong>gagne</strong> → 8 ÷ 1 × 2 = <strong>16 pts</strong></li>
            <li>il finit 12ᵉ → <strong>0 pt</strong></li>
          </ul>
          Miser sur un outsider (grosse côte) qui marche fort rapporte donc beaucoup !
        </div>
      </div>

      <div className="card">
        <h2>⚡️ Les bonus</h2>
        <ul className="rules-list">
          <li>Tu disposes de <strong>2 bonus</strong> pour <strong>tout le Tour</strong>.</li>
          <li>Un bonus <strong>double tes points</strong> sur l’étape choisie (cumulable avec le ×2 victoire).</li>
          <li>À activer <strong>au moment du pari, avant midi</strong>. Une fois utilisés, ils sont consommés.</li>
        </ul>
        <p className="muted">Exemple : ton coureur (côte 8.0) gagne avec un bonus → 8 ÷ 1 × 2 (victoire) × 2 (bonus) = <strong>32 pts</strong>.</p>
      </div>

      <div className="card">
        <h2>📊 Les côtes</h2>
        <p>Les côtes sont calculées automatiquement à partir de la forme des coureurs
          (données ProCyclingStats) : un coureur très en forme a une <strong>côte basse</strong>
          (peu de points mais sûr), un outsider une <strong>côte élevée</strong> (risqué mais payant).</p>
      </div>

      <div className="card">
        <h2>🏆 Le classement</h2>
        <p>Le classement général se met à jour <strong>automatiquement</strong> dès qu’une étape
          est terminée et ses résultats connus. Le total de tous tes points décide du vainqueur du jeu.
          Tu retrouves le détail étape par étape dans l’<strong>historique</strong>.</p>
      </div>

      <div className="card">
        <h2>🔔 Ne rate aucun pari</h2>
        <p>Active les <strong>rappels</strong> dans ton profil : tu reçois une notification
          ~30 min avant la clôture si tu n’as pas encore parié.</p>
      </div>
    </div>
  )
}
