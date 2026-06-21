import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import { AVATARS } from '../lib/avatars'

export default function Profile() {
  const { user, profile, refreshProfile, signOut, setNotice } = useAuth()

  const [pseudo, setPseudo] = useState(profile.pseudo)
  const [avatar, setAvatar] = useState(profile.avatar)
  const [msgP, setMsgP] = useState(null)
  const [savingP, setSavingP] = useState(false)

  const [password, setPassword] = useState('')
  const [msgPw, setMsgPw] = useState(null)
  const [savingPw, setSavingPw] = useState(false)

  const [confirmDel, setConfirmDel] = useState('')
  const [msgDel, setMsgDel] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const dirtyProfile = pseudo.trim() !== profile.pseudo || avatar !== profile.avatar

  async function saveProfile(e) {
    e.preventDefault()
    setSavingP(true); setMsgP(null)
    const { error } = await supabase.from('profiles')
      .update({ pseudo: pseudo.trim(), avatar })
      .eq('id', user.id)
    setSavingP(false)
    if (error) {
      setMsgP({ type: 'error', text: error.code === '23505'
        ? 'Ce pseudo est déjà pris, essaie-en un autre.' : error.message })
    } else {
      setMsgP({ type: 'success', text: 'Profil mis à jour ✅' })
      await refreshProfile()
    }
  }

  async function savePassword(e) {
    e.preventDefault()
    setSavingPw(true); setMsgPw(null)
    const { error } = await supabase.auth.updateUser({ password })
    setSavingPw(false)
    if (error) setMsgPw({ type: 'error', text: error.message })
    else { setMsgPw({ type: 'success', text: 'Mot de passe modifié ✅' }); setPassword('') }
  }

  async function deleteAccount() {
    if (confirmDel !== 'SUPPRIMER') return
    setDeleting(true); setMsgDel(null)
    const { error } = await supabase.rpc('delete_account')
    if (error) { setDeleting(false); setMsgDel({ type: 'error', text: error.message }); return }
    setNotice('Ton compte a bien été supprimé. À bientôt sur les routes ! 🚴')
    await signOut()   // session invalide -> retour à l'écran de connexion
  }

  return (
    <div className="stack">
      {/* --- Pseudo + avatar --- */}
      <div className="card">
        <h2>👤 Mon profil</h2>
        <p className="muted">Compte : <strong>{user.email}</strong></p>
        <form onSubmit={saveProfile}>
          <label htmlFor="pseudo">Pseudo</label>
          <input id="pseudo" type="text" required minLength={2} maxLength={24} value={pseudo}
            onChange={(e) => setPseudo(e.target.value)} />

          <label>Avatar</label>
          <div className="avatar-grid">
            {AVATARS.map((a) => (
              <button type="button" key={a.key}
                className={`avatar-choice${avatar === a.key ? ' selected' : ''}`}
                onClick={() => setAvatar(a.key)} title={a.label}>
                <span className="avatar" style={{ background: a.color }}>{a.emoji}</span>
              </button>
            ))}
          </div>

          <button className="primary" disabled={savingP || !dirtyProfile}>
            {savingP ? '…' : 'Enregistrer'}
          </button>
          {msgP && <p className={msgP.type}>{msgP.text}</p>}
        </form>
      </div>

      {/* --- Mot de passe --- */}
      <div className="card">
        <h2>🔒 Mot de passe</h2>
        <form onSubmit={savePassword}>
          <label htmlFor="pw">Nouveau mot de passe</label>
          <input id="pw" type="password" required minLength={6} value={password}
            autoComplete="new-password"
            onChange={(e) => setPassword(e.target.value)} placeholder="•••••• (6 caractères min.)" />
          <button className="primary" disabled={savingPw || !password}>
            {savingPw ? '…' : 'Changer le mot de passe'}
          </button>
          {msgPw && <p className={msgPw.type}>{msgPw.text}</p>}
        </form>
      </div>

      {/* --- Zone dangereuse --- */}
      <div className="card danger">
        <h2>⚠️ Supprimer mon compte</h2>
        <p className="muted">
          Action <strong>irréversible</strong> : ton profil, tes paris et tes messages
          seront définitivement supprimés. Tape <code>SUPPRIMER</code> pour confirmer.
        </p>
        <input type="text" value={confirmDel} placeholder="SUPPRIMER"
          onChange={(e) => setConfirmDel(e.target.value)} />
        <button className="danger-btn" disabled={deleting || confirmDel !== 'SUPPRIMER'}
          onClick={deleteAccount}>
          {deleting ? '…' : 'Supprimer définitivement mon compte'}
        </button>
        {msgDel && <p className={msgDel.type}>{msgDel.text}</p>}
      </div>
    </div>
  )
}
