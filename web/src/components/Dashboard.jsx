import TodayBet from './TodayBet.jsx'
import Leaderboard from './Leaderboard.jsx'

export default function Dashboard() {
  return (
    <div className="dash">
      <section className="dash-hero">
        <div>
          <h1>Le Tour entre potes 🚴‍♂️🏆</h1>
          <p>Mise sur le vainqueur de l’étape, marque des points, chambre tes amis.</p>
        </div>
        <div className="hero-jerseys">
          <span title="Maillot jaune">🟡</span>
          <span title="Maillot vert">🟢</span>
          <span title="Maillot à pois">🔴</span>
          <span title="Maillot blanc">⚪</span>
        </div>
      </section>

      <div className="dash-grid">
        <div className="dash-col main">
          <TodayBet />
        </div>
        <aside className="dash-col side">
          <div className="card">
            <h2>🏆 Classement</h2>
            <Leaderboard />
          </div>
        </aside>
      </div>
    </div>
  )
}
