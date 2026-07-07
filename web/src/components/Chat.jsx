import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { useAuth } from '../auth.jsx'
import Avatar from './Avatar.jsx'

const EMOJIS = ['👍', '❤️', '😂', '🔥', '😮', '🚴']

export default function Chat() {
  const { user, profile } = useAuth()
  const [messages, setMessages] = useState([])
  const [profilesMap, setProfilesMap] = useState({})
  const [reactions, setReactions] = useState([])   // { message_id, user_id, emoji }
  const [pickerFor, setPickerFor] = useState(null)  // message dont le sélecteur est ouvert
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const feedRef = useRef(null)

  const loadReactions = useCallback(async () => {
    const { data } = await supabase.from('message_reactions').select('message_id, user_id, emoji')
    setReactions(data ?? [])
  }, [])

  // On fait défiler UNIQUEMENT le fil (pas scrollIntoView, qui ferait défiler
  // toute la page/fenêtre — c'est ce qui décalait la page Chat vers le bas).
  const scrollDown = () => {
    const f = feedRef.current
    if (f) f.scrollTop = f.scrollHeight
  }

  // Résout pseudo/avatar d'un user, en complétant le cache au besoin.
  const resolveProfile = useCallback(async (uid, map) => {
    if (map[uid]) return map[uid]
    const { data } = await supabase.from('profiles').select('id, pseudo, first_name, avatar').eq('id', uid).maybeSingle()
    if (data) setProfilesMap((m) => ({ ...m, [uid]: data }))
    return data
  }, [])

  useEffect(() => {
    (async () => {
      const [{ data: profs }, { data: msgs }] = await Promise.all([
        supabase.from('profiles').select('id, pseudo, first_name, avatar'),
        supabase.from('messages')
          .select('id, content, created_at, user_id, profiles(pseudo, first_name, avatar)')
          .order('created_at', { ascending: true }).limit(200),
      ])
      const map = Object.fromEntries((profs ?? []).map((p) => [p.id, p]))
      setProfilesMap(map)
      setMessages((msgs ?? []).map((m) => ({
        ...m,
        pseudo: m.profiles?.pseudo ?? map[m.user_id]?.pseudo ?? '?',
        first_name: m.profiles?.first_name ?? map[m.user_id]?.first_name,
        avatar: m.profiles?.avatar ?? map[m.user_id]?.avatar,
      })))
      setLoading(false)
      setTimeout(scrollDown, 50)
      loadReactions()

      const channel = supabase.channel('mpv-chat')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
          async (payload) => {
            const m = payload.new
            const p = await resolveProfile(m.user_id, map)
            setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, {
              ...m, pseudo: p?.pseudo ?? '?', first_name: p?.first_name, avatar: p?.avatar,
            }])
            setTimeout(scrollDown, 50)
          })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' },
          () => loadReactions())
        .subscribe()
      return () => supabase.removeChannel(channel)
    })()
  }, [resolveProfile, loadReactions])

  // Ferme la palette (ouverte au tap) dès qu'on clique ailleurs.
  useEffect(() => {
    if (pickerFor == null) return
    const close = () => setPickerFor(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [pickerFor])

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

  // Ajoute/retire sa réaction (optimiste ; le temps réel resynchronise).
  async function toggleReaction(messageId, emoji) {
    setPickerFor(null)
    const mine = reactions.some((r) =>
      r.message_id === messageId && r.user_id === user.id && r.emoji === emoji)
    if (mine) {
      setReactions((prev) => prev.filter((r) =>
        !(r.message_id === messageId && r.user_id === user.id && r.emoji === emoji)))
      await supabase.from('message_reactions').delete()
        .match({ message_id: messageId, user_id: user.id, emoji })
    } else {
      setReactions((prev) => [...prev, { message_id: messageId, user_id: user.id, emoji }])
      await supabase.from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji })
    }
  }

  return (
    <div className="card chat">
      <h2>💬 Le café des parieurs</h2>
      <div className="chat-feed" ref={feedRef}>
        {loading ? <p className="muted">Chargement…</p>
          : messages.length === 0 ? <p className="muted">Personne n’a encore causé. Lance la discussion !</p>
          : messages.map((m) => {
            const mine = m.user_id === user.id
            const byEmoji = {}; const mineSet = new Set()
            for (const r of reactions) {
              if (r.message_id !== m.id) continue
              const who = r.user_id === user.id ? 'Toi'
                : (profilesMap[r.user_id]?.pseudo || '?')
              ;(byEmoji[r.emoji] ??= []).push(who)
              if (r.user_id === user.id) mineSet.add(r.emoji)
            }
            const grouped = Object.entries(byEmoji)
              .map(([emoji, names]) => ({ emoji, count: names.length, names: names.join(', ') }))
            return (
              <div key={m.id} className={`msg${mine ? ' mine' : ''}`}
                onMouseLeave={() => setPickerFor((p) => (p === m.id ? null : p))}>
                {!mine && <Avatar name={m.avatar} size={32} />}
                <div className="msg-col">
                  <div className="bubble"
                    onClick={(e) => { e.stopPropagation(); setPickerFor(pickerFor === m.id ? null : m.id) }}>
                    {!mine && <span className="msg-author" title={m.first_name || undefined}>{m.pseudo}</span>}
                    <span className="msg-text">{m.content}</span>
                  </div>
                  <div className="msg-reactions">
                    {grouped.map((g) => (
                      <button key={g.emoji} type="button" title={g.names}
                        className={`reaction${mineSet.has(g.emoji) ? ' mine' : ''}`}
                        onClick={() => toggleReaction(m.id, g.emoji)}>
                        {g.emoji} {g.count}
                      </button>
                    ))}
                    <span className={`react-picker${pickerFor === m.id ? ' open' : ''}`}
                      onClick={(e) => e.stopPropagation()}>
                      {EMOJIS.map((e) => (
                        <button key={e} type="button" onClick={() => toggleReaction(m.id, e)}>{e}</button>
                      ))}
                    </span>
                  </div>
                </div>
                {mine && <Avatar name={profile?.avatar} size={32} />}
              </div>
            )
          })}
      </div>
      <form className="chat-input" onSubmit={send}>
        <input value={text} maxLength={500} placeholder="Balance ta vanne…"
          onChange={(e) => setText(e.target.value)} />
        <button className="primary" type="submit" disabled={!text.trim()}>Envoyer</button>
      </form>
    </div>
  )
}
