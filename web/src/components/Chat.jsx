import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import Avatar from './Avatar.jsx'

export default function Chat() {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [profilesMap, setProfilesMap] = useState({})
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const bottomRef = useRef(null)

  const scrollDown = () => bottomRef.current?.scrollIntoView({ behavior: 'smooth' })

  // Résout pseudo/avatar d'un user, en complétant le cache au besoin.
  const resolveProfile = useCallback(async (uid, map) => {
    if (map[uid]) return map[uid]
    const { data } = await supabase.from('profiles').select('id, pseudo, avatar').eq('id', uid).maybeSingle()
    if (data) setProfilesMap((m) => ({ ...m, [uid]: data }))
    return data
  }, [])

  useEffect(() => {
    (async () => {
      const [{ data: profs }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('id, pseudo, avatar'),
        supabase.from('messages')
          .select('id, content, created_at, user_id, profiles(pseudo, avatar)')
          .order('created_at', { ascending: true }).limit(200),
      ])
      const map = Object.fromEntries((profs ?? []).map((p) => [p.id, p]))
      setProfilesMap(map)
      setMessages((msgs ?? []).map((m) => ({
        ...m,
        pseudo: m.profiles?.pseudo ?? map[m.user_id]?.pseudo ?? '?',
        avatar: m.profiles?.avatar ?? map[m.user_id]?.avatar,
      })))
      setLoading(false)
      setTimeout(scrollDown, 50)

      const channel = supabase.channel('mpv-chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
          async (payload) => {
            const m = payload.new
            const p = await resolveProfile(m.user_id, map)
            setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, {
              ...m, pseudo: p?.pseudo ?? '?', avatar: p?.avatar,
            }])
            setTimeout(scrollDown, 50)
          })
        .subscribe()
      return () => supabase.removeChannel(channel)
    })()
  }, [resolveProfile])

  async function send(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content) return
    setText('')
    // On récupère la ligne insérée pour l'afficher tout de suite, sans dépendre
    // du temps réel (qui peut manquer un événement). Le handler Realtime déduplique
    // par id, donc aucun doublon si l'événement finit par arriver.
    const { data, error } = await supabase.from('messages')
      .insert({ user_id: user.id, content })
      .select('id, content, created_at, user_id').single()
    if (error) { setText(content); return }  // on restaure en cas d'échec
    if (data) {
      setMessages((prev) => prev.some((x) => x.id === data.id) ? prev : [...prev, {
        ...data, pseudo: profile?.pseudo ?? '?', avatar: profile?.avatar,
      }])
      setTimeout(scrollDown, 50)
    }
  }

  return (
    <div className="card chat">
      <h2>💬 Le café des parieurs</h2>
      <div className="chat-feed">
        {loading ? <p className="muted">Chargement…</p>
          : messages.length === 0 ? <p className="muted">Personne n’a encore causé. Lance la discussion !</p>
          : messages.map((m) => {
            const mine = m.user_id === user.id
            return (
              <div key={m.id} className={`msg${mine ? ' mine' : ''}`}>
                {!mine && <Avatar name={m.avatar} size={32} />}
                <div className="bubble">
                  {!mine && <span className="msg-author">{m.pseudo}</span>}
                  <span className="msg-text">{m.content}</span>
                </div>
                {mine && <Avatar name={profile?.avatar} size={32} />}
              </div>
            )
          })}
        <div ref={bottomRef} />
      </div>
      <form className="chat-input" onSubmit={send}>
        <input value={text} maxLength={500} placeholder="Balance ta vanne…"
          onChange={(e) => setText(e.target.value)} />
        <button className="primary" type="submit" disabled={!text.trim()}>Envoyer</button>
      </form>
    </div>
  )
}
